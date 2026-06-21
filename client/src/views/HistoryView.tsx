import { useState, useEffect } from 'react'

interface HistoryItem {
  id: string
  name: string
  artist: string
  feedback: 'like' | 'neutral' | 'dislike'
  ts: number
  source?: string
}

const FEEDBACK_EMOJI: Record<string, string> = {
  like: '\u2764\uFE0F',
  neutral: '\u{1F44D}',
  dislike: '\u{1F44E}',
}
const FEEDBACK_COLOR: Record<string, string> = {
  like: 'text-accent-2',
  neutral: 'text-accent',
  dislike: 'text-danger',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

export function HistoryView() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/history?limit=30')
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          if (data.ok) setItems(data.history || [])
          else setError(data.error || '加载失败')
        }
      })
      .catch(() => { if (!cancelled) setError('请求失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="mb-4 rounded-3xl border border-border bg-glass backdrop-blur-md p-5">
      <div className="mb-2 text-[0.7rem] uppercase tracking-[1.5px] text-accent">
        HISTORY
      </div>
      <h2 className="text-lg font-semibold text-text mb-4">播放历史</h2>

      {loading && <p className="text-muted text-sm">加载中…</p>}
      {error && <p className="text-danger text-sm">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-muted text-sm">还没有播放记录，点击「下一首」开始。</p>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-1">
          {items.map((item, i) => (
            <div
              key={`${item.id}-${item.ts}-${i}`}
              className="flex items-center gap-3 py-2.5 px-1 border-b border-border last:border-b-0"
            >
              <span className={`text-sm ${FEEDBACK_COLOR[item.feedback] || 'text-muted'}`}>
                {FEEDBACK_EMOJI[item.feedback] || ''}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{item.name}</p>
                <p className="text-xs text-muted truncate">{item.artist}</p>
              </div>
              <span className="text-xs text-muted shrink-0">{timeAgo(item.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
