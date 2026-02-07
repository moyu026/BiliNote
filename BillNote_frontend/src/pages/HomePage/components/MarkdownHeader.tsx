'use client'

import { useEffect, useState } from 'react'
import { Copy, Download, BrainCircuit, Play, MessageSquareText } from 'lucide-react' // Import new icons
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select' // Added SelectValue
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { API_BASE_URL } from '@/lib/api' // Assuming API_BASE_URL exists for fetching embedding models

interface VersionNote {
  ver_id: string
  model_name?: string
  style?: string
  created_at?: string
}

interface NoteHeaderProps {
  currentTask?: {
    markdown: VersionNote[] | string
    audioMeta: {
      original_url: string; // Add original_url to currentTask
    }
    id: string; // Add task id
  }
  isMultiVersion: boolean
  currentVerId: string
  setCurrentVerId: (id: string) => void
  modelName: string
  style: string
  noteStyles: { value: string; label: string }[]
  onCopy: () => void
  onDownload: () => void
  createAt?: string | Date
  showTranscribe: (show: boolean) => void
  viewMode: 'map' | 'preview' // Added viewMode
  setViewMode: (mode: 'map' | 'preview') => void // Added setViewMode
  onPlayVideo: (url: string) => void // New prop for playing video
  onOpenRag: (taskId: string, embeddingModelName: string) => void // New prop for opening RAG Q&A
  selectedEmbeddingModel: string; // New prop for selected embedding model
  setSelectedEmbeddingModel: (model: string) => void; // New prop for setting embedding model
}

export function MarkdownHeader({
  currentTask,
  isMultiVersion,
  currentVerId,
  setCurrentVerId,
  modelName,
  style,
  noteStyles,
  onCopy,
  onDownload,
  createAt,
  showTranscribe,
  setShowTranscribe,
  viewMode,
  setViewMode,
  onPlayVideo, // Destructure new prop
  onOpenRag, // Destructure new prop
  selectedEmbeddingModel, // Destructure new prop
  setSelectedEmbeddingModel, // Destructure new prop
}: NoteHeaderProps) {
  const [copied, setCopied] = useState(false)
  const [embeddingModels, setEmbeddingModels] = useState<string[]>([])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (copied) {
      timer = setTimeout(() => setCopied(false), 2000)
    }
    return () => clearTimeout(timer)
  }, [copied])

  // Fetch available embedding models on component mount
  useEffect(() => {
    const fetchEmbeddingModels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/rag/embedding_models`)
        if (!response.ok) {
          throw new Error('Failed to fetch embedding models')
        }
        const models = await response.json()
        console.log('Fetched embedding models:', models)
        setEmbeddingModels(models)
        if (models.length > 0 && !selectedEmbeddingModel) {
          setSelectedEmbeddingModel(models[0]) // Select the first model by default
        }
      } catch (error) {
        console.error('Error fetching embedding models:', error)
        // Optionally show a toast error to the user
      }
    }
    fetchEmbeddingModels()
  }, [selectedEmbeddingModel, setSelectedEmbeddingModel])

  // Debug: Log currentTask to check original_url
  useEffect(() => {
    console.log('=== MarkdownHeader Debug ===')
    console.log('currentTask:', currentTask)
    console.log('audioMeta:', currentTask?.audioMeta)
    console.log('original_url:', currentTask?.audioMeta?.original_url)
    console.log('task id:', currentTask?.id)
    console.log('selectedEmbeddingModel:', selectedEmbeddingModel)
    console.log('embeddingModels:', embeddingModels)
  }, [currentTask, selectedEmbeddingModel, embeddingModels])


  const handleCopy = () => {
    onCopy()
    setCopied(true)
  }

  const styleName = noteStyles.find(v => v.value === style)?.label || style

  const reversedMarkdown: VersionNote[] = Array.isArray(currentTask?.markdown)
    ? [...currentTask!.markdown].reverse()
    : []

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    return d
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(/\//g, '-')
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white/95 px-4 py-2 backdrop-blur-sm">
      {/* 左侧区域：版本 + 标签 + 创建时间 + Embedding Model Selector */}
      <div className="flex flex-wrap items-center gap-3">
        {isMultiVersion && (
          <Select value={currentVerId} onValueChange={setCurrentVerId}>
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue placeholder="选择版本" />
            </SelectTrigger>

            <SelectContent>
              {(currentTask?.markdown || []).map((v, idx) => {
                const shortId = v.ver_id.slice(-6)
                return (
                  <SelectItem key={v.ver_id} value={v.ver_id}>
                    {`版本（${shortId}）`}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}
        {/* New Embedding Model Selector */}
        <Select value={selectedEmbeddingModel} onValueChange={setSelectedEmbeddingModel}>
            <SelectTrigger className="h-8 w-[180px] text-sm">
                <SelectValue placeholder={selectedEmbeddingModel || "选择 Embedding 模型"} />
            </SelectTrigger>
            <SelectContent>
                {embeddingModels.map((model) => (
                    <SelectItem key={model} value={model}>
                        {model}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>


        <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-200">
          {modelName}
        </Badge>
        <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200">
          {styleName}
        </Badge>

        {createAt && (
          <div className="text-muted-foreground text-sm">创建时间: {formatDate(createAt)}</div>
        )}
      </div>

      {/* 右侧操作按钮 */}
      <div className="flex items-center gap-1">
        {/* Play Button */}
        {currentTask?.audioMeta?.original_url && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={() => onPlayVideo(currentTask.audioMeta.original_url)}
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                        >
                            <Play className="mr-1.5 h-4 w-4" />
                            <span className="text-sm">播放</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>播放视频</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
        {/* RAG Q&A Button */}
        {currentTask?.id && selectedEmbeddingModel && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={() => onOpenRag(currentTask.id, selectedEmbeddingModel)}
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                        >
                            <MessageSquareText className="mr-1.5 h-4 w-4" />
                            <span className="text-sm">RAG 问答</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>RAG 问答</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  setViewMode(viewMode == 'preview' ? 'map' : 'preview')
                }}
                variant="ghost"
                size="sm"
                className="h-8 px-2"
              >
                <BrainCircuit className="mr-1.5 h-4 w-4" />
                <span className="text-sm">{viewMode == 'preview' ? '思维导图' : 'markdown'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>思维导图</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleCopy} variant="ghost" size="sm" className="h-8 px-2">
                <Copy className="mr-1.5 h-4 w-4" />
                <span className="text-sm">{copied ? '已复制' : '复制'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>复制内容</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onDownload} variant="ghost" size="sm" className="h-8 px-2">
                <Download className="mr-1.5 h-4 w-4" />
                <span className="text-sm">导出 Markdown</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>下载为 Markdown 文件</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  setShowTranscribe(!showTranscribe)
                }}
                variant="ghost"
                size="sm"
                className="h-8 px-2"
              >
                {/*<Download className="mr-1.5 h-4 w-4" />*/}
                <span className="text-sm">原文参照</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>原文参照</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
