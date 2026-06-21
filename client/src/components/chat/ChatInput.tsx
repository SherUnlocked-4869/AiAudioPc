import { useState, type FormEvent } from 'react'

interface ChatInputProps {
  onSend: (text: string) => void
}

const QUICK_ACTIONS = ['早上好', '来点轻松的', '下一首', '晚上好']

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  const handleQuick = (phrase: string) => {
    onSend(phrase)
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="跟 Claudio 说点什么…"
          autoComplete="off"
          className="flex-1 bg-glass-input backdrop-blur-md border border-border text-text px-3 py-2.5 rounded-lg outline-none text-sm"
        />
        <button
          type="submit"
          className="bg-accent-2 text-black border-none px-4 py-2.5 rounded-lg cursor-pointer font-semibold text-sm"
        >
          发送
        </button>
      </form>
      <div className="flex gap-2 mt-3 flex-wrap">
        {QUICK_ACTIONS.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => handleQuick(phrase)}
            className="bg-transparent border border-border text-muted px-3 py-1.5 rounded-2xl cursor-pointer text-xs
              hover:border-accent hover:text-accent transition-colors"
          >
            {phrase}
          </button>
        ))}
      </div>
    </div>
  )
}
