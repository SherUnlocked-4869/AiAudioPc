interface PlayControlsProps {
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onNext: () => void
}

export function PlayControls({ isPlaying, onPlay, onPause, onNext }: PlayControlsProps) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <button
        type="button"
        onClick={isPlaying ? onPause : onPlay}
        className="w-14 h-14 rounded-full border-2 border-text bg-transparent text-text text-lg flex items-center justify-center cursor-pointer"
        aria-label={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        type="button"
        onClick={onNext}
        className="flex-1 h-[52px] rounded-[26px] border border-border bg-glass-2 backdrop-blur-md text-text text-base flex items-center justify-center gap-2 cursor-pointer
          hover:border-accent hover:text-accent transition-colors"
      >
        ▶▶ 下一首
      </button>
    </div>
  )
}
