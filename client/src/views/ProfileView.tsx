import { useState, useEffect } from 'react'

export function ProfileView() {
  const [taste, setTaste] = useState('')
  const [routines, setRoutines] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/taste').then(r => r.json()),
      fetch('/api/plan/today').then(r => r.json()),
    ])
      .then(([tasteData, planData]) => {
        if (!cancelled) {
          if (tasteData.ok) setTaste(tasteData.taste || '')
          if (planData.ok) setRoutines(planData.routines || '')
        }
      })
      .catch(() => { if (!cancelled) setError('请求失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="mb-4 rounded-3xl border border-border bg-panel p-5">
      <div className="mb-2 text-[0.7rem] uppercase tracking-[1.5px] text-accent">
        PROFILE
      </div>
      <h2 className="text-lg font-semibold text-text mb-4">音乐品味</h2>

      {loading && <p className="text-muted text-sm">加载中…</p>}
      {error && <p className="text-danger text-sm">{error}</p>}

      {!loading && !error && !taste && !routines && (
        <p className="text-muted text-sm">暂无品味数据，多听几首歌后 AI 会为你生成音乐画像。</p>
      )}

      {taste && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            你的音乐偏好
          </h3>
          <div className="text-sm text-text leading-relaxed whitespace-pre-line">
            {taste}
          </div>
        </div>
      )}

      {routines && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            今日节律
          </h3>
          <div className="text-sm text-text leading-relaxed whitespace-pre-line">
            {routines}
          </div>
        </div>
      )}
    </section>
  )
}
