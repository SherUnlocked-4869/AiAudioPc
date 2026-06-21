import { useClaudioContext } from '@/hooks/useClaudio'
import { TrackInfo } from '@/components/player/TrackInfo'
import { ProgressBar } from '@/components/player/ProgressBar'
import { DJSay } from '@/components/player/DJSay'
import { FeedbackBar } from '@/components/player/FeedbackBar'
import { PlayControls } from '@/components/player/PlayControls'
import { ChatHistory } from '@/components/chat/ChatHistory'
import { ChatInput } from '@/components/chat/ChatInput'

export function PlayerView() {
  const claudio = useClaudioContext()

  return (
    <section className="mb-4 rounded-3xl border border-border bg-glass backdrop-blur-md p-5">
      <TrackInfo track={claudio.currentTrack} />

      {claudio.currentTrack && (
        <FeedbackBar current={claudio.feedback} onSubmit={claudio.submitFeedback} />
      )}

      <ProgressBar
        currentTime={claudio.currentTime}
        duration={claudio.duration}
        onSeek={claudio.seek}
      />

      <DJSay djText={claudio.djText} onReplayTTS={claudio.replayTTS} />

      <PlayControls
        isPlaying={claudio.isPlaying}
        onPlay={claudio.play}
        onPause={claudio.pause}
        onNext={claudio.next}
      />

      <div className="mt-4 pt-4 border-t border-border">
        <div className="text-[0.7rem] uppercase tracking-[1.5px] text-accent mb-3">
          WS 流式聊天
        </div>
        <ChatHistory messages={claudio.messages} />
        <ChatInput onSend={claudio.sendChat} />
      </div>
    </section>
  )
}
