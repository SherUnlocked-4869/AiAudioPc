import { cn } from '@/lib/utils'

type MessageRole = 'user' | 'assistant'

export interface ChatMessageData {
  role: MessageRole
  text: string
  meta?: string
}

interface ChatMessageProps {
  message: ChatMessageData
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'px-3 py-2.5 rounded-[10px] max-w-[80%] text-sm leading-relaxed',
        message.role === 'user'
          ? 'self-end bg-panel-2 border border-border'
          : 'self-start bg-[rgba(212,168,83,0.1)] border border-[rgba(212,168,83,0.3)]',
      )}
    >
      {message.text}
      {message.meta && (
        <small className="block mt-1 text-muted text-xs">{message.meta}</small>
      )}
    </div>
  )
}
