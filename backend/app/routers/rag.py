from fastapi import APIRouter, HTTPException, Depends
from app.services.rag_service import RAGService
from app.gpt.gpt_factory import GPTFactory
from pydantic import BaseModel

router = APIRouter()

class RAGQuery(BaseModel):
    task_id: str
    question: str
    embedding_model_name: str  # New field for embedding model selection
    llm_model_name: str  # LLM model name for generating answers
    provider_id: str  # Provider ID for the LLM

class RAGAnswer(BaseModel):
    answer: str
    source_timestamps: list[tuple[float, float, str]] # (start, end, text)

@router.post("/ask", response_model=RAGAnswer)
async def ask_rag(query: RAGQuery, rag_service: RAGService = Depends(RAGService)):
    """
    接收用户的RAG查询并返回答案，包含原文索引和对应视频时间戳。
    """
    try:
        # Use the LLM model name from the query
        answer, sources = await rag_service.ask(
            task_id=query.task_id,
            question=query.question,
            llm_model_name=query.llm_model_name,
            provider_id=query.provider_id,
            embedding_model_name=query.embedding_model_name
        )
        return RAGAnswer(answer=answer, source_timestamps=sources)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/embedding_models")
async def get_embedding_models():
    """
    返回可用的Embedding模型列表。
    """
    return RAGService.get_available_embedding_models()

@router.get("/debug/task/{task_id}")
async def debug_task(task_id: str):
    """
    调试端点：返回任务的 audio_meta 信息
    """
    import os
    import json
    audio_file = os.path.join("note_results", f"{task_id}_audio.json")
    if os.path.exists(audio_file):
        with open(audio_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {"exists": True, "data": data}
    return {"exists": False, "message": "Audio file not found"}
