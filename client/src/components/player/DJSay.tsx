interface DJSayProps {
  djText: string
  onReplayTTS: () => void
}

export function DJSay({ djText, onReplayTTS }: DJSayProps) {
  return (
    <div className="mb-6">
      <div className="text-[0.65rem] uppercase tracking-[2px] text-accent mb-2.5">AITUNE</div>
      <p className="m-0 mb-3 text-text text-[0.95rem] leading-relaxed min-h-[48px]">
        {djText || '说出你想听的风格，或者直接点击「下一首」。'}
      </p>
      <button
        type="button"
        onClick={onReplayTTS}
        className="bg-transparent border border-border text-muted px-3 py-1.5 rounded-2xl cursor-pointer text-xs
          hover:border-accent hover:text-accent transition-colors"
      >
        ▶ 重播 DJ 语音
      </button>
    </div>
  )
}
