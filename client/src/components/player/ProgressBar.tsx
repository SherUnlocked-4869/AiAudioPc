interface ProgressBarProps {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function ProgressBar({ currentTime, duration, onSeek }: ProgressBarProps) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="mb-6">
      <input
        type="range"
        value={pct}
        min={0}
        max={100}
        step={0.1}
        onChange={(e) => {
          if (duration > 0) {
            onSeek((parseFloat(e.target.value) / 100) * duration)
          }
        }}
        className="w-full h-1 bg-border rounded-sm appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-accent
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
      />
      <div className="flex justify-between text-xs text-muted mt-1.5">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
