export interface Track {
  id?: string
  name: string
  artist: string
  url?: string
  feedback?: 'like' | 'neutral' | 'dislike'
}

interface TrackInfoProps {
  track: Track | null
}

export function TrackInfo({ track }: TrackInfoProps) {
  if (!track) {
    return (
      <div className="flex gap-4 items-center mb-5">
        <div className="w-[110px] h-[110px] flex-shrink-0 bg-gradient-to-br from-[#1f1f2e] to-[#2d2d44] rounded-2xl flex items-center justify-center text-4xl text-accent border border-border">
          ♪
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="m-0 mb-1.5 text-xl font-semibold text-text leading-snug break-words">
            等待播放…
          </h2>
          <p className="m-0 text-muted text-[0.95rem]">Claudio</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 items-center mb-5">
      <div className="w-[110px] h-[110px] flex-shrink-0 bg-gradient-to-br from-[#1f1f2e] to-[#2d2d44] rounded-2xl flex items-center justify-center text-4xl text-accent border border-border">
        ♪
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="m-0 mb-1.5 text-xl font-semibold text-text leading-snug break-words">
          {track.name}
        </h2>
        <p className="m-0 text-muted text-[0.95rem]">{track.artist}</p>
      </div>
    </div>
  )
}
