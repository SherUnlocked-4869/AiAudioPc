export function TopBar({ online = false }: { online?: boolean }) {
  return (
    <header className="relative border-b border-border py-6 text-center">
      <h1 className="m-0 text-3xl font-light tracking-widest text-accent">Claudio</h1>
      <span className="mt-1.5 block text-sm text-muted">
        个人 AI 电台 · 读懂听歌习惯 → 规划声音 → 像 DJ 那样播报
      </span>
      <span
        className={`absolute right-0 top-6 text-xs ${online ? 'text-accent-2' : 'text-danger'}`}
      >
        {online ? '● 在线' : '● 离线'}
      </span>
    </header>
  )
}
