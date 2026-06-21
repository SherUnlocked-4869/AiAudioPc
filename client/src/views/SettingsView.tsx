import { useState } from 'react'

export function SettingsView() {
  const [analyzing, setAnalyzing] = useState(false)
  const [msg, setMsg] = useState('')

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setMsg('')
    try {
      const r = await fetch('/api/taste/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist: [] }),
      })
      const data = await r.json()
      setMsg(data.ok ? '品味分析完成，刷新 Profile 页查看。' : data.error || '分析失败')
    } catch {
      setMsg('请求失败')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <section className="mb-4 rounded-3xl border border-border bg-glass backdrop-blur-md p-5">
      <div className="mb-2 text-[0.7rem] uppercase tracking-[1.5px] text-accent">
        SETTINGS
      </div>
      <h2 className="text-lg font-semibold text-text mb-4">设置</h2>

      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-medium text-text mb-1.5">AI 音乐品味分析</h3>
          <p className="text-xs text-muted mb-3">
            基于你的播放历史和反馈，让 AI 重新分析你的音乐偏好。
          </p>
          <button
            type="button"
            disabled={analyzing}
            onClick={handleAnalyze}
            className="bg-transparent border border-accent text-accent px-4 py-2 rounded-xl cursor-pointer text-xs
              hover:bg-accent hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? '分析中…' : '重新分析品味'}
          </button>
          {msg && (
            <p className={`mt-2 text-xs ${msg.includes('完成') ? 'text-accent' : 'text-danger'}`}>
              {msg}
            </p>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-medium text-text mb-1.5">关于 Claudio</h3>
          <p className="text-xs text-muted leading-relaxed">
            Claudio 是你的个人 AI 电台 DJ。它通过 DeepSeek 理解你的听歌习惯和当前心情，
            使用 MIMO TTS 生成自然的 DJ 语音，为你规划每一首歌。
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] text-muted">
            <span className="bg-panel-2 px-2 py-0.5 rounded">DeepSeek</span>
            <span className="bg-panel-2 px-2 py-0.5 rounded">MIMO TTS</span>
            <span className="bg-panel-2 px-2 py-0.5 rounded">NetEase Music</span>
            <span className="bg-panel-2 px-2 py-0.5 rounded">WebSocket</span>
          </div>
        </div>
      </div>
    </section>
  )
}
