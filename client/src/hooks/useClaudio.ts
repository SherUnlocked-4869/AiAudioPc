import { useState, useRef, useEffect, useCallback, createContext, useContext, createElement } from 'react'

// ── Local interfaces ──

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
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  djText: string
  currentTTS: string | null
  feedback: FeedbackType | null
  messages: ChatMessageData[]
  audioAnalyser: AnalyserNode | null
  isAudioActive: boolean
  isOnline: boolean
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
  if (!ctx) throw new Error('useClaudioContext must be used within a <ClaudioProvider>')
  return ctx
}

// ── Internal hook ──

export function useClaudio(): ClaudioState {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [djText, setDjText] = useState('说出你想听的风格，或者直接点击「下一首」。')
  const [currentTTS, setCurrentTTS] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackType | null>(null)
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null)
  const [isAudioActive, setIsAudioActive] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  const [ttsVersion, setTtsVersion] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const startTimeRef = useRef(0)
  const offsetRef = useRef(0)
  const resumePromiseRef = useRef<Promise<void> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const queueRef = useRef<Track[]>([])
  const tickRafRef = useRef(0)

  const currentTrackRef = useRef(currentTrack)
  currentTrackRef.current = currentTrack
  const currentTTSRef = useRef(currentTTS)
  currentTTSRef.current = currentTTS

  // ═══════════════════════════════════════════════
  // Callbacks ordered by dependency (leaf → consumer)
  // ═══════════════════════════════════════════════

  // ---- Audio setup: call during user gesture ----
  const setupAudioContext = useCallback(() => {
    if (audioContextRef.current) return
    const ctx = new AudioContext()
    audioContextRef.current = ctx

    // TTS audio element
    if (!ttsAudioRef.current) {
      ttsAudioRef.current = new Audio()
      setTtsVersion(v => v + 1)
    }

    // Analyser → destination (BufferSource will be connected during playback)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyserRef.current = analyser
    analyser.connect(ctx.destination)
    setAudioAnalyser(analyser)

    if (ctx.state === 'suspended') {
      resumePromiseRef.current = ctx.resume()
    }
  }, [])

  // ---- playSongOnly: fetch + decode + BufferSource (immune to autoplay) ----
  const playSongOnly = useCallback(async () => {
    const track = currentTrackRef.current
    if (!track) return
    const ctx = audioContextRef.current
    if (!ctx) return

    const url = track.id ? `/api/stream?id=${track.id}` : track.url
    if (!url) return

    // Stop previous source
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch {}
      sourceNodeRef.current = null
    }
    cancelAnimationFrame(tickRafRef.current)

    try {
      // Wait for AudioContext to be running (resume triggered during user gesture)
      if (resumePromiseRef.current) {
        await resumePromiseRef.current
        resumePromiseRef.current = null
      } else if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const resp = await fetch(url)
      const buf = await resp.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(buf)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      sourceNodeRef.current = source

      const analyser = analyserRef.current
      if (analyser) {
        // Disconnect analyser to reconnect with new source
        try { analyser.disconnect() } catch {}
        source.connect(analyser)
        analyser.connect(ctx.destination)
      } else {
        source.connect(ctx.destination)
      }

      const offset = offsetRef.current
      source.start(0, offset)
      startTimeRef.current = ctx.currentTime - offset
      offsetRef.current = 0

      setIsPlaying(true)
      setIsAudioActive(true)
      setDuration(audioBuffer.duration)

      source.onended = () => {
        sourceNodeRef.current = null
        setIsPlaying(false)
        setIsAudioActive(false)
        if (queueRef.current.length) {
          const n = queueRef.current.shift()!
          setCurrentTrack(n)
          playSongOnly()
        }
      }

      // Time tracking
      const tick = () => {
        if (!sourceNodeRef.current) return
        const e = ctx.currentTime - startTimeRef.current
        setCurrentTime(Math.min(e, audioBuffer.duration))
        if (e < audioBuffer.duration) {
          tickRafRef.current = requestAnimationFrame(tick)
        }
      }
      tickRafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      console.error('playSongOnly error:', err)
      setDjText('音频加载失败')
    }
  }, [])

  // ---- TTS helpers ----
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

  // ---- TTS event binding ----
  useEffect(() => {
    const tts = ttsAudioRef.current
    if (!tts) return
    const onEnd = () => { if (currentTrackRef.current) playSongOnly() }
    const onErr = () => { if (currentTrackRef.current) playSongOnly() }
    tts.addEventListener('ended', onEnd)
    tts.addEventListener('error', onErr)
    return () => {
      tts.removeEventListener('ended', onEnd)
      tts.removeEventListener('error', onErr)
    }
  }, [playSongOnly, ttsVersion])

  // ---- WS message handler ----
  const handleWSMessage = useCallback((data: WSMessage) => {
    switch (data.type) {
      case 'hello':
        if (data.text) setMessages(p => [...p, { role: 'assistant', text: data.text! }])
        break
      case 'progress':
        break
      case 'response': {
        const say = data.say || 'Claudio 暂时没有想好怎么说…'
        setDjText(say)
        setCurrentTTS(data.tts || null)
        if (sourceNodeRef.current) { try { sourceNodeRef.current.stop() } catch {}; sourceNodeRef.current = null }
        if (ttsAudioRef.current) ttsAudioRef.current.pause()
        setIsPlaying(false)
        setIsAudioActive(false)
        cancelAnimationFrame(tickRafRef.current)
        offsetRef.current = 0
        if (data.play?.length) {
          const t = data.play.find(x => x.url)
          if (t) {
            const m: Track = { id: t.id, name: t.name, artist: t.artist, url: t.url, feedback: t.feedback }
            setCurrentTrack(m)
            setFeedback(t.feedback || 'neutral')
            currentTrackRef.current = m
            currentTTSRef.current = data.tts || null
            playTTSThenSong()
          }
          const idx = data.play.findIndex(x => x.url)
          queueRef.current = data.play.slice(idx + 1).filter(x => x.url).map(x => ({
            id: x.id, name: x.name, artist: x.artist, url: x.url, feedback: x.feedback,
          }))
        } else {
          currentTTSRef.current = data.tts || null
          if (data.tts) playTTSOnly()
        }
        const meta = data.play?.map(t => `《${t.name}》-${t.artist}`).join(' / ')
        setMessages(p => [...p, { role: 'assistant', text: say, meta }])
        break
      }
      case 'scheduler':
        if (data.text) setMessages(p => [...p, { role: 'assistant', text: `【节律】${data.text}` }])
        break
      case 'error':
        if (data.message) setDjText('出错了：' + data.message)
        break
    }
  }, [playTTSThenSong, playTTSOnly])

  // ---- WebSocket ----
  const connectWS = useCallback(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/stream`)
    wsRef.current = ws
    ws.onopen = () => {
      setIsOnline(true)
      setMessages(p => [...p, { role: 'assistant', text: 'Claudio 已上线，随时陪你听歌。' }])
    }
    ws.onclose = () => { setIsOnline(false); reconnectTimerRef.current = setTimeout(connectWS, 3000) }
    ws.onmessage = (ev) => {
      try { handleWSMessage(JSON.parse(ev.data)) } catch {}
    }
  }, [handleWSMessage])

  // ---- User actions ----
  const seek = useCallback((time: number) => {
    offsetRef.current = time
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop() } catch {}; sourceNodeRef.current = null }
    cancelAnimationFrame(tickRafRef.current)
    setIsPlaying(false)
    playSongOnly()
  }, [playSongOnly])

  const pause = useCallback(() => {
    if (sourceNodeRef.current) {
      offsetRef.current = (audioContextRef.current?.currentTime || 0) - startTimeRef.current
      try { sourceNodeRef.current.stop() } catch {}
      sourceNodeRef.current = null
    }
    cancelAnimationFrame(tickRafRef.current)
    ttsAudioRef.current?.pause()
    setIsPlaying(false)
    setIsAudioActive(false)
  }, [])

  const play = useCallback(() => {
    setupAudioContext()
    playSongOnly()
  }, [setupAudioContext, playSongOnly])

  const next = useCallback(() => {
    queueRef.current = []
    pause()
    setupAudioContext()
    setDjText('Claudio 正在规划下一首…')
    setMessages(p => [...p, { role: 'user', text: '下一首' }])
    fetch('/api/next').then(r => r.json())
      .then((d: WSMessage) => handleWSMessage({ ...d, type: 'response' }))
      .catch((err: Error) => setDjText('出错了：' + err.message))
  }, [pause, setupAudioContext, handleWSMessage])

  const replayTTS = useCallback(() => { playTTSOnly() }, [playTTSOnly])

  const submitFeedback = useCallback(async (type: FeedbackType) => {
    if (!currentTrackRef.current) return
    try {
      await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentTrackRef.current.id, feedback: type }),
      })
      setFeedback(type)
    } catch {}
  }, [])

  const sendChat = useCallback((text: string) => {
    setupAudioContext()
    setMessages(p => [...p, { role: 'user', text }])
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', text }))
    } else {
      fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).then(r => r.json())
        .then((d: WSMessage) => handleWSMessage({ ...d, type: 'response' }))
        .catch(() => setDjText('请求失败'))
    }
  }, [setupAudioContext, handleWSMessage])

  // ---- Lifecycle ----
  useEffect(() => {
    connectWS()
    return () => {
      wsRef.current?.close()
      clearTimeout(reconnectTimerRef.current)
      cancelAnimationFrame(tickRafRef.current)
      audioContextRef.current?.close()
    }
  }, [connectWS])

  return {
    currentTrack, isPlaying, currentTime, duration,
    djText, currentTTS, feedback, messages,
    audioAnalyser, isAudioActive, isOnline,
    play, pause, next, seek, replayTTS, submitFeedback, sendChat,
  }
}

// ── Provider ──

export function ClaudioProvider({ children }: { children: React.ReactNode }) {
  const state = useClaudio()
  return createElement(ClaudioContext.Provider, { value: state }, children)
}
