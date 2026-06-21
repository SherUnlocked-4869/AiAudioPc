import { cn } from '@/lib/utils'

type FeedbackType = 'like' | 'neutral' | 'dislike'

interface FeedbackBarProps {
  current: FeedbackType | null
  onSubmit: (type: FeedbackType) => void
}

const FEEDBACK_OPTIONS: { type: FeedbackType; label: string }[] = [
  { type: 'like', label: '喜欢' },
  { type: 'neutral', label: '还行' },
  { type: 'dislike', label: '讨厌' },
]

export function FeedbackBar({ current, onSubmit }: FeedbackBarProps) {
  return (
    <div className="flex items-center justify-center gap-2 my-3 text-sm text-muted">
      <span>这首感觉：</span>
      {FEEDBACK_OPTIONS.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          onClick={() => onSubmit(type)}
          className={cn(
            'bg-transparent border border-border text-muted px-3.5 py-1.5 rounded-2xl cursor-pointer text-xs transition-colors',
            'hover:border-accent hover:text-accent',
            current === type && 'border-accent text-accent',
            current === type && type === 'like' && 'border-accent-2 text-accent-2',
            current === type && type === 'dislike' && 'border-danger text-danger',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
