import { useEffect, useRef } from 'react'
import { ChatMessage, type ChatMessageData } from './ChatMessage'

interface ChatHistoryProps {
  messages: ChatMessageData[]
}

export function ChatHistory({ messages }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 mb-3">
        <p className="text-muted text-xs text-center py-4">暂无消息</p>
      </div>
    )
  }

  return (
    <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 mb-3">
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
