import { useState, useRef, useEffect, useCallback, createContext, useContext, createElement } from 'react'

// ── Local interfaces (compatible with components, avoids circular deps) ──

type FeedbackType = 'like' | 'neutral' | 'dislike'

interface Track {
  id?: string
  name: string
  artist: string
  url?: string
  feedback?: FeedbackType
}

interface ChatMessageData {
  role: 'user' | 'assistant'
  text: string
  meta?: string
}

interface WSMessage {
  type: string
  text?: string
  message?: string
  stage?: string
  say?: string
  tts?: string
  play?: Array<{
    id?: string
    name: string
    artist: string
    url?: string
    feedback?: FeedbackType
  }>
  error?: string
}

// ── Public state interface ──

export interface ClaudioState {
  // Playback
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number

  // DJ
  djText: string
  currentTTS: string | null

  // Feedback
  feedback: FeedbackType | null

  // Chat
  messages: ChatMessageData[]

  // Audio analysis
  audioAnalyser: AnalyserNode | null
  isAudioActive: boolean

  // Actions
  play: () => void
  pause: () => void
  next: () => void
  seek: (time: number) => void
  replayTTS: () => void
  submitFeedback: (type: FeedbackType) => Promise<void>
  sendChat: (text: string) => void
}

// ── Context ──

export const ClaudioContext = createContext<ClaudioState | null>(null)

export function useClaudioContext(): ClaudioState {
  const ctx = useContext(ClaudioContext)
  if (!ctx) {
    throw new Error('useClaudioContext must be used within a <ClaudioProvider>')
  }
  return ctx
}

// ── Internal hook ──

export function useClaudio(): ClaudioState {
  // Playback state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // DJ state
  const [djText, setDjText] = useState('说出你想听的风格，或者直接点击「下一首」。')
  const [currentTTS, setCurrentTTS] = useState<string | null>(null)

  // Feedback
  const [feedback, setFeedback] = useState<FeedbackType | null>(null)

  // Chat
  const [messages, setMessages] = useState<ChatMessageData[]>([])

  // Audio analysis
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null)
  const [isAudioActive, setIsAudioActive] = useState(false)

  // Refs for non-reactive values
  const wsRef = useRef<WebSocket | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const queueRef = useRef<Track[]>([])

  // Refs to expose latest values to WS handlers without re-registering listeners
  const currentTrackRef = useRef(currentTrack)
  currentTrackRef.current = currentTrack

  const currentTTSRef = useRef(currentTTS)
  currentTTSRef.current = currentTTS

  // ---- WebSocket ----
  const connectWS = useCallback(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${location.host}/stream`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Claudio 已上线，随时陪你听歌。' },
      ])
    }

    ws.onclose = () => {
      reconnectTimerRef.current = setTimeout(connectWS, 3000)
    }

    ws.onmessage = (ev) => {
      try {
        const data: WSMessage = JSON.parse(ev.data)
        handleWSMessage(data)
      } catch {
        // Ignore malformed messages
      }
    }
  }, [])

  const handleWSMessage = useCallback((data: WSMessage) => {
    switch (data.type) {
      case 'hello':
        if (data.text) {
          setMessages((prev) => [...prev, { role: 'assistant', text: data.text! }])
        }
        break

      case 'progress':
        // Progress updates — could show in a status indicator
        break

      case 'response': {
        const say = data.say || 'Claudio 暂时没有想好怎么说…'
        setDjText(say)
        setCurrentTTS(data.tts || null)

        // Stop any current playback
        if (audioRef.current) audioRef.current.pause()
        if (ttsAudioRef.current) ttsAudioRef.current.pause()
        setIsPlaying(false)
        setIsAudioActive(false)

        if (data.play && data.play.length) {
          const track = data.play.find((t) => t.url)
          if (track) {
            const mapped: Track = {
              id: track.id,
              name: track.name,
              artist: track.artist,
              url: track.url,
              feedback: track.feedback,
            }
            setCurrentTrack(mapped)
            setFeedback(track.feedback || null)
            playTTSThenSong()
          }
          const idx = data.play.findIndex((t) => t.url)
          queueRef.current = data.play.slice(idx + 1).filter((t) => t.url).map((t) => ({
            id: t.id,
            name: t.name,
            artist: t.artist,
            url: t.url,
            feedback: t.feedback,
          }))
        } else {
          if (data.tts) playTTSOnly()
        }

        const meta = data.play?.map((t) => `《${t.name}》-${t.artist}`).join(' / ')
        setMessages((prev) => [...prev, { role: 'assistant', text: say, meta }])
        break
      }

      case 'scheduler':
        if (data.text) {
          setMessages((prev) => [...prev, { role: 'assistant', text: `【节律】${data.text}` }])
        }
        break

      case 'error':
        if (data.message) {
          setDjText('出错了：' + data.message)
        }
        break
    }
  }, [])

  // ---- Audio setup ----
  const setupAudioContext = useCallback(() => {
    if (audioContextRef.current) return

    const ctx = new AudioContext()
    audioContextRef.current = ctx

    // Create song audio element if not exists
    if (!audioRef.current) {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audioRef.current = audio
    }

    // Create TTS audio element if not exists
    if (!ttsAudioRef.current) {
      ttsAudioRef.current = new Audio()
    }

    // Connect analyser
    try {
      const source = ctx.createMediaElementSource(audioRef.current)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)
      analyser.connect(ctx.destination)
      setAudioAnalyser(analyser)
    } catch {
      // Already connected
    }

    if (ctx.state === 'suspended') {
      ctx.resume()
    }
  }, [])

  // ---- Audio event binding ----
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onPlay = () => {
      setIsPlaying(true)
      setIsAudioActive(true)
    }
    const onPause = () => {
      setIsPlaying(false)
      setIsAudioActive(false)
    }
    const onEnded = () => {
      setIsPlaying(false)
      setIsAudioActive(false)
      if (queueRef.current.length) {
        const next = queueRef.current.shift()!
        setCurrentTrack(next)
        playSongOnly()
      }
    }
    const onError = () => {
      setIsPlaying(false)
      setIsAudioActive(false)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [])

  // TTS audio event binding
  useEffect(() => {
    const tts = ttsAudioRef.current
    if (!tts) return

    const onTtsEnded = () => {
      if (currentTrackRef.current) playSongOnly()
    }
    const onTtsError = () => {
      if (currentTrackRef.current) playSongOnly()
    }

    tts.addEventListener('ended', onTtsEnded)
    tts.addEventListener('error', onTtsError)

    return () => {
      tts.removeEventListener('ended', onTtsEnded)
      tts.removeEventListener('error', onTtsError)
    }
  }, [])

  // ---- Playback actions ----
  const playSongOnly = useCallback(() => {
    const track = currentTrackRef.current
    if (!track) return
    const audio = audioRef.current
    if (!audio) return

    const url = track.id ? `/api/stream?id=${track.id}` : track.url
    if (!url) return
    audio.src = url
    audio.currentTime = 0
    audio.play().catch(() => {
      setDjText('点击播放按钮开始')
    })
  }, [])

  const playTTSOnly = useCallback(() => {
    const tts = ttsAudioRef.current
    const ttsUrl = currentTTSRef.current
    if (!tts || !ttsUrl) return
    tts.src = ttsUrl
    tts.play().catch(console.error)
  }, [])

  const playTTSThenSong = useCallback(() => {
    const ttsUrl = currentTTSRef.current
    if (ttsUrl) {
      const tts = ttsAudioRef.current
      if (tts) {
        tts.src = ttsUrl
        tts.play().catch(() => playSongOnly())
      }
    } else {
      playSongOnly()
    }
  }, [playSongOnly])

  const play = useCallback(() => {
    setupAudioContext()
    const audio = audioRef.current
    if (!audio || !audio.src) return
    audio.play().catch(() => {})
  }, [setupAudioContext])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    ttsAudioRef.current?.pause()
  }, [])

  const next = useCallback(() => {
    pause()
    setDjText('Claudio 正在规划下一首…')
    setMessages((prev) => [...prev, { role: 'user', text: '下一首' }])
    fetch('/api/next')
      .then((r) => r.json())
      .then((data: WSMessage) => handleWSMessage({ ...data, type: 'response' }))
      .catch((err) => setDjText('出错了：' + err.message))
  }, [pause, handleWSMessage])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  const replayTTS = useCallback(() => {
    playTTSOnly()
  }, [playTTSOnly])

  const submitFeedback = useCallback(async (type: FeedbackType) => {
    if (!currentTrackRef.current) return
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentTrackRef.current.id, feedback: type }),
      })
      setFeedback(type)
    } catch {
      // silently fail
    }
  }, [])

  const sendChat = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }])
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', text }))
    } else {
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
        .then((r) => r.json())
        .then((data: WSMessage) => handleWSMessage({ ...data, type: 'response' }))
        .catch(() => setDjText('请求失败'))
    }
  }, [handleWSMessage])

  // ---- Lifecycle ----
  useEffect(() => {
    connectWS()
    return () => {
      wsRef.current?.close()
      clearTimeout(reconnectTimerRef.current)
      audioContextRef.current?.close()
    }
  }, [connectWS])

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    djText,
    currentTTS,
    feedback,
    messages,
    audioAnalyser,
    isAudioActive,
    play,
    pause,
    next,
    seek,
    replayTTS,
    submitFeedback,
    sendChat,
  }
}

// ── Provider component ──

export function ClaudioProvider({ children }: { children: React.ReactNode }) {
  const state = useClaudio()
  return createElement(ClaudioContext.Provider, { value: state }, children)
}
