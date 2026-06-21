# InteractiveDots Refactor + PlayerView Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the InteractiveDots background so dots are always visible and interactive, then migrate the full Player view (playback, chat, feedback) from the old vanilla JS PWA to the React TypeScript app.

**Architecture:** Refactor InteractiveDots with two-tier opacity (base + proximity peak), breathing animation, and audio-reactive mode driven by an `AnalyserNode`. Centralize all Player state (WebSocket, audio, chat, feedback) in a `useClaudio` hook. Break Player UI into focused sub-components. Wire the audio analyser from the hook through App.tsx to InteractiveDots for music-reactive dots.

**Tech Stack:** React 18.3, TypeScript 5.5, Vite 5.3, Tailwind CSS 3.4, Vitest 1.6, jsdom

## Spec Reference

`docs/superpowers/specs/2026-06-21-dots-refactor-and-player-migration-design.md`

## Global Constraints

- React `^18.3.1`, TypeScript `^5.5.3`, Vite `^5.3.4`, Tailwind `^3.4.x`, Vitest `^1.6.0`
- Vite `base: '/react/'` unchanged
- Backend `server.js` unchanged — `/react` mount already in place
- Old PWA at `/` untouched
- Dots default color `#d4a853`
- Port 8080 occupied → backend uses `PORT=3001`; port 5173 occupied → Vite uses `3002`; proxy targets updated to `http://localhost:3001`

---

### Task 1: Update port configuration

**Files:**
- Modify: `client/vite.config.ts`
- Modify: `.env`

**Produces:** Backend on `:3001`, Vite dev on `:3002`, proxy targets correct.

- [ ] **Step 1: Update .env to use port 3001**

```bash
# In .env, change PORT=8080 to PORT=3001
```

Edit `D:\workspace\AiAudioPc - 副本\.env` line 1:
```
PORT=3001
```

- [ ] **Step 2: Update vite.config.ts port and proxy targets**

Edit `D:\workspace\AiAudioPc - 副本\client\vite.config.ts`:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/react/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/stream': { target: 'ws://localhost:3001', ws: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: Verify backend starts on port 3001**

```bash
cd "D:\workspace\AiAudioPc - 副本" && timeout 5 node server.js 2>&1 || true
```

Expected: `[claudio] server running at http://localhost:3001`

- [ ] **Step 4: Commit**

```bash
git add .env client/vite.config.ts
git commit -m "chore: switch dev ports to 3001 (backend) and 3002 (Vite)"
```

---

### Task 2: Refactor InteractiveDots component

**Files:**
- Modify: `client/src/components/ui/interactive-dots.tsx`
- Modify: `client/src/components/ui/interactive-dots.test.tsx`

**Produces:** `InteractiveDotsProps` with `dotColor`, `dotSize` (default 30), `baseOpacity` (0.35), `peakOpacity` (0.85), `audioAnalyser?`, `className`. Always-visible dots with breathing animation, cursor proximity glow, and audio-reactive mode.

**Removes:** `opacity` prop (replaced by `baseOpacity`/`peakOpacity`).

- [ ] **Step 1: Update the tests**

Edit `D:\workspace\AiAudioPc - 副本\client\src\components\ui\interactive-dots.test.tsx`:

```typescript
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { InteractiveDots } from '@/components/ui/interactive-dots'

describe('InteractiveDots', () => {
  it('renders a canvas element', () => {
    const { container } = render(<InteractiveDots />)
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('accepts custom dotColor, dotSize, baseOpacity and peakOpacity without throwing', () => {
    const { container } = render(
      <InteractiveDots dotColor="#ff0000" dotSize={24} baseOpacity={0.3} peakOpacity={0.9} />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('accepts an audioAnalyser prop (reserved) without throwing', () => {
    const { container } = render(
      <InteractiveDots audioAnalyser={undefined} />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('has dotSize default of 30', () => {
    // Props are defaults — component renders without error
    const { container } = render(<InteractiveDots />)
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npx vitest run src/components/ui/interactive-dots.test.tsx 2>&1
```

Expected: Tests fail because `baseOpacity`/`peakOpacity` props don't exist yet, `opacity` prop removed.

- [ ] **Step 3: Write the refactored InteractiveDots component**

Replace `D:\workspace\AiAudioPc - 副本\client\src\components\ui\interactive-dots.tsx`:

```tsx
import { useEffect, useRef } from "react"

interface InteractiveDotsProps {
  dotColor?: string
  dotSize?: number
  baseOpacity?: number
  peakOpacity?: number
  audioAnalyser?: AnalyserNode
  className?: string
}

export function InteractiveDots({
  dotColor = "#d4a853",
  dotSize = 30,
  baseOpacity = 0.35,
  peakOpacity = 0.85,
  audioAnalyser,
  className = "",
}: InteractiveDotsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const mouseTarget = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const frameCountRef = useRef(0)
  const dotsRef = useRef<Dot[]>([])
  const animationIdRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      rebuildDots()
    }
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    const CIRCLE_W = dotSize
    const ACTUAL_W = CIRCLE_W * 0.72
    const MIN_W = ACTUAL_W * 0.15
    const CIRCLE_DIST = CIRCLE_W / 2

    const noise = (x: number, y: number, z: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453
      return n - Math.floor(n)
    }

    const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
      outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin)

    class Dot {
      position: { x: number; y: number }
      decay: number

      constructor(posX: number, posY: number) {
        this.position = { x: posX, y: posY }
        this.decay = 0
      }

      calcWidth(): { radius: number; opacity: number } {
        const dx = mousePos.current.x - this.position.x
        const dy = mousePos.current.y - this.position.y
        let delta = Math.sqrt(dx * dx + dy * dy)

        const noiseVal = noise(this.position.x, this.position.y, frameCountRef.current)
        const noiseMap = 0.7 + noiseVal * 0.5
        delta *= noiseMap

        const GREATER = Math.max(canvas.width, canvas.height)
        const halfGreater = GREATER / 2

        if (delta > halfGreater) {
          delta = halfGreater
        }

        // Proximity factor: 0 = far, 1 = at cursor
        const rawProximity = 1 - delta / halfGreater
        const proximityFactor = Math.max(0, Math.min(1, rawProximity))

        // Smooth decay: ease toward current proximity over ~300ms
        const decaySpeed = 0.1
        this.decay += (proximityFactor - this.decay) * decaySpeed

        // Radius: base radius (MIN_W) + proximity bonus
        const dynamicRadius = MIN_W + (ACTUAL_W - MIN_W) * this.decay

        // Opacity: base + proximity bonus
        const dynamicOpacity = baseOpacity + (peakOpacity - baseOpacity) * this.decay

        // Breathing animation (when no audio)
        const breathAmount = 1 + 0.15 * Math.sin((frameCountRef.current / 240) * Math.PI * 2)

        let finalRadius = dynamicRadius
        let finalOpacity = dynamicOpacity

        if (audioAnalyser) {
          try {
            const bufferLength = audioAnalyser.frequencyBinCount
            const dataArray = new Uint8Array(bufferLength)
            audioAnalyser.getByteFrequencyData(dataArray)

            // Split into 3 bands
            const bassEnd = Math.floor(bufferLength * 0.1)
            const midEnd = Math.floor(bufferLength * 0.5)

            let bassSum = 0, midSum = 0, highSum = 0
            for (let i = 0; i < bufferLength; i++) {
              if (i < bassEnd) bassSum += dataArray[i]
              else if (i < midEnd) midSum += dataArray[i]
              else highSum += dataArray[i]
            }
            const bassAvg = bassSum / bassEnd
            const midAvg = midSum / (midEnd - bassEnd)
            const highAvg = highSum / (bufferLength - midEnd)

            const radiusScale = mapRange(bassAvg, 0, 255, 0.8, 1.6)
            const proximityGain = mapRange(midAvg, 0, 255, 0.3, 1.0)

            finalRadius = dynamicRadius * radiusScale * breathAmount
            finalOpacity = dynamicOpacity * mapRange(radiusScale, 0.8, 1.6, 0.7, 1.0)
            // Use proximityGain for noise variation in jitter (applied per-dot below)
            const jitterMultiplier = mapRange(highAvg, 0, 255, 0.5, 2.0)
            finalRadius *= (0.9 + noiseVal * 0.2 * jitterMultiplier)
          } catch {
            // Fallback to breathing mode
            finalRadius = dynamicRadius * breathAmount
            finalOpacity = dynamicOpacity
          }
        } else {
          finalRadius = dynamicRadius * breathAmount
          finalOpacity = dynamicOpacity
        }

        return { radius: Math.max(0.5, finalRadius), opacity: finalOpacity }
      }

      render() {
        const { radius, opacity } = this.calcWidth()
        ctx!.globalAlpha = opacity
        ctx!.fillStyle = dotColor
        ctx!.beginPath()
        ctx!.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    let dots: Dot[] = []

    function rebuildDots() {
      const COLS = Math.ceil(canvas.width / CIRCLE_DIST) + 1
      const ROWS = Math.ceil(canvas.height / CIRCLE_DIST) + 1
      dots = []
      for (let ci = 0; ci < COLS; ci++) {
        for (let ri = 0; ri < ROWS; ri++) {
          dots.push(new Dot(ci * CIRCLE_DIST, ri * CIRCLE_DIST))
        }
      }
    }

    rebuildDots()

    const handleMouseMove = (e: MouseEvent) => {
      mouseTarget.current = { x: e.clientX, y: e.clientY }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseTarget.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("touchmove", handleTouchMove)

    const animate = () => {
      // Smooth mouse interpolation
      mousePos.current = {
        x: mousePos.current.x + (mouseTarget.current.x - mousePos.current.x) * 0.08,
        y: mousePos.current.y + (mouseTarget.current.y - mousePos.current.y) * 0.08,
      }

      ctx!.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach((dot) => dot.render())
      frameCountRef.current++
      animationIdRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchmove", handleTouchMove)
      cancelAnimationFrame(animationIdRef.current)
    }
  }, [dotColor, dotSize, baseOpacity, peakOpacity, audioAnalyser])

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full h-screen ${className}`}
      style={{ display: "block", background: "transparent" }}
    />
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npx vitest run src/components/ui/interactive-dots.test.tsx 2>&1
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ui/interactive-dots.tsx client/src/components/ui/interactive-dots.test.tsx
git commit -m "feat: refactor InteractiveDots with two-tier opacity, breathing animation, and audio-reactive mode"
```

---

### Task 3: Update App.tsx for new dots props

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/App.test.tsx`

**Consumes:** New `InteractiveDots` props (`baseOpacity`, `peakOpacity`, `audioAnalyser?`; removed `opacity`).
**Produces:** App renders with new dots defaults. `audioAnalyser` hook wired (initially `undefined` — hook comes in Task 8).

- [ ] **Step 1: Update App.tsx**

Edit `D:\workspace\AiAudioPc - 副本\client\src\App.tsx`:

```tsx
import { useState } from 'react'
import { InteractiveDots } from '@/components/ui/interactive-dots'
import { TopBar } from '@/components/shell/TopBar'
import { TabNav, type Tab } from '@/components/shell/TabNav'
import { ViewContainer } from '@/components/shell/ViewContainer'

const TABS: Tab[] = [
  { id: 'player', label: 'Player' },
  { id: 'history', label: 'History' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [active, setActive] = useState('player')

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 -z-10">
        <InteractiveDots dotColor="#d4a853" dotSize={30} />
      </div>
      <div className="relative z-0 mx-auto max-w-[900px] p-4">
        <TopBar online={false} />
        <TabNav tabs={TABS} activeId={active} onTabChange={setActive} />
        <ViewContainer active={active} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update App.test.tsx**

`client/src/App.test.tsx` — the `opacity` prop reference is no longer used in App.tsx, but the test doesn't inspect props. Verify it still passes with the new component. No test changes needed; the test renders `<App />` which now uses defaults.

- [ ] **Step 3: Run all existing tests**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npx vitest run 2>&1
```

Expected: All 16 tests pass.

- [ ] **Step 4: Verify build**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npm run build 2>&1
```

Expected: TypeScript compiles + Vite builds successfully.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: update App to use refactored InteractiveDots with new defaults"
```

---

### Task 4: Create TrackInfo component

**Files:**
- Create: `client/src/components/player/TrackInfo.tsx`

**Produces:** `TrackInfo` component displaying cover placeholder + song name + artist.

- [ ] **Step 1: Write the component**

Create `D:\workspace\AiAudioPc - 副本\client\src\components\player\TrackInfo.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/player/TrackInfo.tsx
git commit -m "feat: add TrackInfo component with cover placeholder"
```

---

### Task 5: Create ProgressBar component

**Files:**
- Create: `client/src/components/player/ProgressBar.tsx`

**Produces:** `ProgressBar` with draggable range input + current time / duration display.

- [ ] **Step 1: Write the component**

Create `D:\workspace\AiAudioPc - 副本\client\src\components\player\ProgressBar.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/player/ProgressBar.tsx
git commit -m "feat: add ProgressBar component"
```

---

### Task 6: Create DJSay component

**Files:**
- Create: `client/src/components/player/DJSay.tsx`

- [ ] **Step 1: Write the component**

Create `D:\workspace\AiAudioPc - 副本\client\src\components\player\DJSay.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/player/DJSay.tsx
git commit -m "feat: add DJSay component"
```

---

### Task 7: Create FeedbackBar component

**Files:**
- Create: `client/src/components/player/FeedbackBar.tsx`

- [ ] **Step 1: Write the component**

Create `D:\workspace\AiAudioPc - 副本\client\src\components\player\FeedbackBar.tsx`:

```tsx
import { cn } from '@/lib/utils'

type FeedbackType = 'like' | 'neutral' | 'dislike'

interface FeedbackBarProps {
  current: FeedbackType | null
  onSubmit: (type: FeedbackType) => void
}

const FEEDBACK_OPTIONS: { type: FeedbackType; label: string }[] = [
  { type: 'like', label: '喜欢' },
  { type: 'neutral', label: '还行' },
  { type: 'dislike', label: '讨厌' },
]

export function FeedbackBar({ current, onSubmit }: FeedbackBarProps) {
  return (
    <div className="flex items-center justify-center gap-2 my-3 text-sm text-muted">
      <span>这首感觉：</span>
      {FEEDBACK_OPTIONS.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          onClick={() => onSubmit(type)}
          className={cn(
            'bg-transparent border border-border text-muted px-3.5 py-1.5 rounded-2xl cursor-pointer text-xs transition-colors',
            'hover:border-accent hover:text-accent',
            current === type && 'border-accent text-accent',
            current === type && type === 'like' && 'border-accent-2 text-accent-2',
            current === type && type === 'dislike' && 'border-danger text-danger',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/player/FeedbackBar.tsx
git commit -m "feat: add FeedbackBar component"
```

---

### Task 8: Create PlayControls component

**Files:**
- Create: `client/src/components/player/PlayControls.tsx`

- [ ] **Step 1: Write the component**

Create `D:\workspace\AiAudioPc - 副本\client\src\components\player\PlayControls.tsx`:

```tsx
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
        className="flex-1 h-[52px] rounded-[26px] border border-border bg-panel-2 text-text text-base flex items-center justify-center gap-2 cursor-pointer
          hover:border-accent hover:text-accent transition-colors"
      >
        ▶▶ 下一首
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/player/PlayControls.tsx
git commit -m "feat: add PlayControls component"
```

---

### Task 9: Create ChatMessage component

**Files:**
- Create: `client/src/components/chat/ChatMessage.tsx`

- [ ] **Step 1: Write the component**

Create `D:\workspace\AiAudioPc - 副本\client\src\components\chat\ChatMessage.tsx`:

```tsx
import { cn } from '@/lib/utils'

type MessageRole = 'user' | 'assistant'

export interface ChatMessageData {
  role: MessageRole
  text: string
  meta?: string
}

interface ChatMessageProps {
  message: ChatMessageData
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'px-3 py-2.5 rounded-[10px] max-w-[80%] text-sm leading-relaxed',
        message.role === 'user'
          ? 'self-end bg-panel-2 border border-border'
          : 'self-start bg-[rgba(212,168,83,0.1)] border border-[rgba(212,168,83,0.3)]',
      )}
    >
      {message.text}
      {message.meta && (
        <small className="block mt-1 text-muted text-xs">{message.meta}</small>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/chat/ChatMessage.tsx
git commit -m "feat: add ChatMessage component"
```

---

### Task 10: Create ChatHistory component

**Files:**
- Create: `client/src/components/chat/ChatHistory.tsx`

**Consumes:** `ChatMessageData` from Task 9.

- [ ] **Step 1: Write the component**

Create `D:\workspace\AiAudioPc - 副本\client\src\components\chat\ChatHistory.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { ChatMessage, type ChatMessageData } from './ChatMessage'

interface ChatHistoryProps {
  messages: ChatMessageData[]
}

export function ChatHistory({ messages }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 mb-3">
        <p className="text-muted text-xs text-center py-4">暂无消息</p>
      </div>
    )
  }

  return (
    <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 mb-3">
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/chat/ChatHistory.tsx
git commit -m "feat: add ChatHistory component"
```

---

### Task 11: Create ChatInput component

**Files:**
- Create: `client/src/components/chat/ChatInput.tsx`

- [ ] **Step 1: Write the component**

Create `D:\workspace\AiAudioPc - 副本\client\src\components\chat\ChatInput.tsx`:

```tsx
import { useState, type FormEvent } from 'react'

interface ChatInputProps {
  onSend: (text: string) => void
}

const QUICK_ACTIONS = ['早上好', '来点轻松的', '下一首', '晚上好']

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  const handleQuick = (phrase: string) => {
    onSend(phrase)
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="跟 Claudio 说点什么…"
          autoComplete="off"
          className="flex-1 bg-bg border border-border text-text px-3 py-2.5 rounded-lg outline-none text-sm"
        />
        <button
          type="submit"
          className="bg-accent-2 text-black border-none px-4 py-2.5 rounded-lg cursor-pointer font-semibold text-sm"
        >
          发送
        </button>
      </form>
      <div className="flex gap-2 mt-3 flex-wrap">
        {QUICK_ACTIONS.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => handleQuick(phrase)}
            className="bg-transparent border border-border text-muted px-3 py-1.5 rounded-2xl cursor-pointer text-xs
              hover:border-accent hover:text-accent transition-colors"
          >
            {phrase}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/chat/ChatInput.tsx
git commit -m "feat: add ChatInput component with quick actions"
```

---

### Task 12: Create useClaudio hook

**Files:**
- Create: `client/src/hooks/useClaudio.ts`

**Consumes:** `Track` from Task 4, `ChatMessageData` from Task 9.
**Produces:** `useClaudio()` returning `ClaudioState` with all player state and actions.

- [ ] **Step 1: Write the hook**

Create `D:\workspace\AiAudioPc - 副本\client\src\hooks\useClaudio.ts`:

```typescript
import { useState, useRef, useEffect, useCallback } from 'react'
import type { Track } from '@/components/player/TrackInfo'
import type { ChatMessageData } from '@/components/chat/ChatMessage'

type FeedbackType = 'like' | 'neutral' | 'dislike'

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
    if (!tts || !currentTTS) return
    tts.src = currentTTS
    tts.play().catch(console.error)
  }, [currentTTS])

  const playTTSThenSong = useCallback(() => {
    if (currentTTS) {
      const tts = ttsAudioRef.current
      if (tts) {
        tts.src = currentTTS
        tts.play().catch(() => playSongOnly())
      }
    } else {
      playSongOnly()
    }
  }, [currentTTS, playSongOnly])

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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useClaudio.ts
git commit -m "feat: add useClaudio hook for WebSocket, audio, chat, and feedback state"
```

---

### Task 13: Rewrite PlayerView

**Files:**
- Modify: `client/src/views/PlayerView.tsx`

**Consumes:** `useClaudio` (Task 12), `TrackInfo` (Task 4), `ProgressBar` (Task 5), `DJSay` (Task 6), `FeedbackBar` (Task 7), `PlayControls` (Task 8), `ChatHistory` (Task 10), `ChatInput` (Task 11).

- [ ] **Step 1: Rewrite PlayerView**

Replace `D:\workspace\AiAudioPc - 副本\client\src\views\PlayerView.tsx`:

```tsx
import { useClaudio } from '@/hooks/useClaudio'
import { TrackInfo } from '@/components/player/TrackInfo'
import { ProgressBar } from '@/components/player/ProgressBar'
import { DJSay } from '@/components/player/DJSay'
import { FeedbackBar } from '@/components/player/FeedbackBar'
import { PlayControls } from '@/components/player/PlayControls'
import { ChatHistory } from '@/components/chat/ChatHistory'
import { ChatInput } from '@/components/chat/ChatInput'

export function PlayerView() {
  const claudio = useClaudio()

  return (
    <section className="mb-4 rounded-3xl border border-border bg-panel p-5">
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
```

- [ ] **Step 2: Run all tests**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npx vitest run 2>&1
```

Expected: All existing tests still pass. (PlayerView is consumed by App which already tests tab switching.)

- [ ] **Step 3: Verify build**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npm run build 2>&1
```

Expected: TypeScript compiles with no errors + Vite builds.

- [ ] **Step 4: Commit**

```bash
git add client/src/views/PlayerView.tsx
git commit -m "feat: rewrite PlayerView with full playback, chat, and feedback UI"
```

---

### Task 14: Wire audioAnalyser from useClaudio to InteractiveDots in App.tsx

**Files:**
- Modify: `client/src/App.tsx`

**Consumes:** `useClaudio` hook, refactored `InteractiveDots`.

- [ ] **Step 1: Update App.tsx to lift useClaudio and pass analyser**

Replace `D:\workspace\AiAudioPc - 副本\client\src\App.tsx`:

```tsx
import { useState } from 'react'
import { InteractiveDots } from '@/components/ui/interactive-dots'
import { TopBar } from '@/components/shell/TopBar'
import { TabNav, type Tab } from '@/components/shell/TabNav'
import { ViewContainer } from '@/components/shell/ViewContainer'
import { useClaudio } from '@/hooks/useClaudio'

const TABS: Tab[] = [
  { id: 'player', label: 'Player' },
  { id: 'history', label: 'History' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [active, setActive] = useState('player')
  const { audioAnalyser } = useClaudio()

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 -z-10">
        <InteractiveDots
          dotColor="#d4a853"
          dotSize={30}
          audioAnalyser={audioAnalyser ?? undefined}
        />
      </div>
      <div className="relative z-0 mx-auto max-w-[900px] p-4">
        <TopBar online={false} />
        <TabNav tabs={TABS} activeId={active} onTabChange={setActive} />
        <ViewContainer active={active} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npx vitest run 2>&1
```

Expected: Tests pass (App test may need update — `useClaudio` uses WebSocket and DOM APIs not in jsdom).

- [ ] **Step 3: Update App.test.tsx if needed**

If the App test fails due to `useClaudio` using WebSocket in jsdom, update `client/src/App.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import App from '@/App'

// Mock useClaudio to avoid WebSocket/DOM dependencies
vi.mock('@/hooks/useClaudio', () => ({
  useClaudio: () => ({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    djText: '',
    currentTTS: null,
    feedback: null,
    messages: [],
    audioAnalyser: null,
    isAudioActive: false,
    play: vi.fn(),
    pause: vi.fn(),
    next: vi.fn(),
    seek: vi.fn(),
    replayTTS: vi.fn(),
    submitFeedback: vi.fn(),
    sendChat: vi.fn(),
  }),
}))

describe('App', () => {
  it('renders the dots canvas and the Claudio title', () => {
    const { container } = render(<App />)
    expect(container.querySelector('canvas')).not.toBeNull()
    expect(screen.getByText('Claudio')).toBeInTheDocument()
  })

  it('shows the Player view heading by default', () => {
    render(<App />)
    // PlayerView now renders TrackInfo which shows "等待播放…" when no track
    expect(screen.getByText('等待播放…')).toBeInTheDocument()
  })

  it('switches to the Settings view when the Settings tab is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeInTheDocument()
    expect(screen.queryByText('等待播放…')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run all tests and verify build**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npx vitest run 2>&1
```

Expected: All tests pass.

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npm run build 2>&1
```

Expected: TypeScript compiles + Vite builds successfully.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "feat: wire audioAnalyser from useClaudio to InteractiveDots in App"
```

---

### Task 15: Final integration — run full test suite and build

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npx vitest run 2>&1
```

Expected: All tests pass, all test files green.

- [ ] **Step 2: Run full build**

```bash
cd "D:\workspace\AiAudioPc - 副本\client" && npm run build 2>&1
```

Expected: TypeScript type-check passes, Vite build succeeds.

- [ ] **Step 3: Verify backend starts**

```bash
cd "D:\workspace\AiAudioPc - 副本" && timeout 5 node server.js 2>&1 || true
```

Expected: `[claudio] server running at http://localhost:3001`

- [ ] **Step 4: Commit if any final tweaks were needed**

```bash
git add -A && git diff --cached --stat
# Review diff, then commit if anything changed
```
