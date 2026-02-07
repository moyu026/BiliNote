import json
import os
from typing import List, Tuple
import chromadb
from chromadb.utils import embedding_functions
from app.gpt.gpt_factory import GPTFactory
from app.models.transcriber_model import TranscriptSegment, TranscriptResult
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ChromaDB客户端初始化
CHROMA_DB_PATH = os.path.join(os.getcwd(), "chroma_db")
client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

class RAGService:
    def __init__(self):
        pass

    @staticmethod
    def get_embedding_function(model_name: str):
        """
        获取 embedding 函数
        支持：
        1. 默认的 SentenceTransformer 模型
        2. 数据库中配置的 BGE 等 embedding 模型（通过 OpenAI 兼容 API）
        """
        if model_name == "default_sentence_transformer":
            return embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        
        # 检查是否是数据库中的模型
        from app.db.model_dao import get_all_models
        try:
            all_models = get_all_models()
            for model in all_models:
                if model['model_name'] == model_name:
                    # 找到了数据库中的模型，使用 OpenAI 兼容的 embedding
                    from app.db.provider_dao import get_provider_by_id
                    provider = get_provider_by_id(model['provider_id'])
                    
                    if provider:
                        # 使用 OpenAI 兼容的 embedding 函数
                        return embedding_functions.OpenAIEmbeddingFunction(
                            api_key=provider.api_key,
                            api_base=provider.base_url,
                            model_name=model_name
                        )
        except Exception as e:
            logger.warning(f"Failed to get model from database, falling back to SentenceTransformer: {e}")
        
        # 如果不是数据库中的模型，尝试作为 HuggingFace 模型
        if "/" in model_name:
            # 支持 HuggingFace 格式的模型 (e.g., "BAAI/bge-large-zh-v1.5")
            return embedding_functions.SentenceTransformerEmbeddingFunction(model_name=model_name)
        
        # 默认使用 SentenceTransformer
        return embedding_functions.SentenceTransformerEmbeddingFunction(model_name=model_name)

    @staticmethod
    def get_available_embedding_models() -> List[str]:
        """
        从数据库获取可用的 Embedding 模型
        只返回 embedding 类型的模型（如 bge, text-embedding 等）
        """
        from app.db.model_dao import get_all_models
        
        try:
            all_models = get_all_models()
            embedding_models = []
            
            # 添加默认模型
            embedding_models.append("default_sentence_transformer")
            
            # 从数据库中筛选 embedding 模型
            for model in all_models:
                model_name = model.get('model_name', '')
                model_name_lower = model_name.lower()
                
                # 检查是否是 embedding 模型（更宽松的匹配）
                is_embedding = any(keyword in model_name_lower for keyword in [
                    'bge', 'embedding', 'embed', 'text-embedding', 'm3'
                ])
                
                if is_embedding:
                    embedding_models.append(model_name)
                    logger.info(f"Found embedding model: {model_name}")
            
            logger.info(f"Available embedding models: {embedding_models}")
            return embedding_models
        except Exception as e:
            logger.error(f"Failed to get embedding models from database: {e}")
            # 返回默认模型作为后备
            return ["default_sentence_transformer"]

    async def create_vector_db(self, task_id: str, embedding_model_name: str):
        transcript_file_path = os.path.join(os.getcwd(), "note_results", f"{task_id}_transcript.json")
        if not os.path.exists(transcript_file_path):
            raise FileNotFoundError(f"Transcript file not found for task {task_id}")

        with open(transcript_file_path, 'r', encoding='utf-8') as f:
            transcript_data = json.load(f)
        
        transcript_result = TranscriptResult(**transcript_data)

        collection_name = f"task_{task_id}_segments"
        embedding_function_instance = self.get_embedding_function(embedding_model_name)
        
        collection = client.get_or_create_collection(
            name=collection_name,
            embedding_function=embedding_function_instance
        )

        documents = []
        metadatas = []
        ids = []

        for i, segment in enumerate(transcript_result.segments):
            documents.append(segment.text)
            metadatas.append({"start": segment.start, "end": segment.end})
            ids.append(f"seg_{i}")

        if documents:
            collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Vector DB created for task {task_id} with {len(documents)} segments.")
        else:
            logger.warning(f"No segments to add for task {task_id}.")

    async def ask(self, task_id: str, question: str, llm_model_name: str, provider_id: str, embedding_model_name: str) -> Tuple[str, List[Tuple[float, float, str]]]:
        collection_name = f"task_{task_id}_segments"
        
        # Get LLM client
        from app.services.provider import ProviderService
        provider = ProviderService.get_provider_by_id(provider_id)
        if not provider:
            return "未找到 LLM 供应商", []
        
        from app.gpt.provider.OpenAI_compatible_provider import OpenAICompatibleProvider
        llm_provider = OpenAICompatibleProvider(
            api_key=provider["api_key"],
            base_url=provider["base_url"]
        )
        llm_client = llm_provider.get_client
        
        try:
            embedding_function_instance = self.get_embedding_function(embedding_model_name)
            collection = client.get_collection(name=collection_name, embedding_function=embedding_function_instance)
        except Exception as e:
            # Collection might not exist if create_vector_db wasn't called or failed
            logger.warning(f"Collection not found for task {task_id}: {e}")
            
            # Use LLM to answer directly
            response = llm_client.chat.completions.create(
                model=llm_model_name,
                messages=[{"role": "user", "content": question}],
                temperature=0.7
            )
            general_answer = response.choices[0].message.content.strip()
            return f"""在视频数据库中未找到相关内容。

通用回答：{general_answer}""", []

        results = collection.query(
            query_texts=[question],
            n_results=5, # Top-k results
            include=['documents', 'metadatas']
        )

        if not results or not results['documents'] or not results['documents'][0]:
            # Use LLM to answer directly
            response = llm_client.chat.completions.create(
                model=llm_model_name,
                messages=[{"role": "user", "content": question}],
                temperature=0.7
            )
            general_answer = response.choices[0].message.content.strip()
            return f"""在视频数据库中未找到相关内容。

通用回答：{general_answer}""", []
        
        retrieved_segments = []
        source_timestamps = []

        for i in range(len(results['documents'][0])):
            text = results['documents'][0][i]
            metadata = results['metadatas'][0][i]
            start_time = metadata['start']
            end_time = metadata['end']
            retrieved_segments.append(text)
            source_timestamps.append((start_time, end_time, text))
        
        context = " ".join(retrieved_segments)
        
        # Construct prompt for LLM
        prompt = f"""根据以下视频内容片段回答问题。如果内容中没有相关信息，请说明。

问题: {question}

视频内容片段:
{context}

回答:"""

        response = llm_client.chat.completions.create(
            model=llm_model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        answer = response.choices[0].message.content.strip()

        return answer, source_timestamps
