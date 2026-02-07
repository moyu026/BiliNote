import React, { FC, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Play } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '@/lib/api'; // Assuming API_BASE_URL for backend calls

interface RagQAProps {
  taskId: string;
  embeddingModelName: string;
  llmModelName: string;  // Add LLM model name
  providerId: string;  // Add provider ID
  onJumpToVideoTime: (url: string, time: number) => void;
}

interface RAGAnswer {
  answer: string;
  source_timestamps: Array<[number, number, string]>; // [start, end, text]
}

export const RagQA: FC<RagQAProps> = ({ taskId, embeddingModelName, llmModelName, providerId, onJumpToVideoTime }) => {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<Array<{ question: string; response: RAGAnswer | null; isLoading: boolean }>>([]);
  const [isSending, setIsSending] = useState(false);

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    if (isSending) return;

    const currentQuestion = question;
    setQuestion(''); // Clear input
    setIsSending(true);
    setAnswers(prev => [...prev, { question: currentQuestion, response: null, isLoading: true }]);

    try {
      const response = await fetch(`${API_BASE_URL}/rag/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
          question: currentQuestion,
          embedding_model_name: embeddingModelName,
          llm_model_name: llmModelName,
          provider_id: providerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch RAG answer');
      }

      const data: RAGAnswer = await response.json();
      setAnswers(prev => prev.map(item => 
        item.question === currentQuestion && item.isLoading 
          ? { ...item, response: data, isLoading: false } 
          : item
      ));
      toast.success('RAG 问答成功');
    } catch (error) {
      console.error('Error asking RAG question:', error);
      setAnswers(prev => prev.map(item => 
        item.question === currentQuestion && item.isLoading 
          ? { ...item, isLoading: false } 
          : item
      ));
      toast.error('RAG 问答失败');
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4 border rounded-md mb-4 bg-gray-50">
        {answers.length === 0 && (
          <div className="text-center text-gray-500">在此输入您关于视频内容的问题</div>
        )}
        {answers.map((qa, index) => ( 
          <div key={index} className="mb-4 p-3 bg-white rounded-lg shadow-sm">
            <p className="font-semibold text-blue-700 mb-2">问: {qa.question}</p>
            {qa.isLoading ? (
              <p className="text-gray-600">正在思考...</p>
            ) : (
              <> 
                <p className="text-gray-800 mb-2">答: {qa.response?.answer || '未找到答案'}</p>
                {qa.response?.source_timestamps && qa.response.source_timestamps.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-1">来源:</p>
                    <ul className="list-disc pl-5 text-sm text-gray-600">
                      {qa.response.source_timestamps.map((source, srcIndex) => (
                        <li key={srcIndex} className="mb-1 flex items-center">
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 h-auto text-blue-500 hover:underline flex items-center"
                            onClick={() => onJumpToVideoTime(
                                (document.querySelector('a.origin-link a') as HTMLAnchorElement)?.href || '', 
                                source[0]
                            )}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            {formatTimestamp(source[0])} - {formatTimestamp(source[1])}
                          </Button>
                          <span className="ml-2">"{source[2].substring(0, 100)}..."</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </ScrollArea>
      <div className="flex gap-2">
        <Input
          placeholder="向视频提问..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !isSending) {
              handleAskQuestion();
            }
          }}
          className="flex-1"
          disabled={isSending}
        />
        <Button onClick={handleAskQuestion} disabled={isSending}>
          <Send className="h-4 w-4 mr-2" /> 提问
        </Button>
      </div>
    </div>
  );
};
