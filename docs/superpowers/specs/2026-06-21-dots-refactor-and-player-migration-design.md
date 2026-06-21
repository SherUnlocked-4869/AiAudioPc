# InteractiveDots Refactor + PlayerView Migration — Design Spec

**Date:** 2026-06-21
**Status:** Approved
**Supersedes / extends:** `2026-06-20-react-dots-background-design.md` (Phase 1) — this spec covers the dots refactor and Phase 2 PlayerView migration.

## Goal

1. Fix the `InteractiveDots` component so the dot background is always visible and responds visually to mouse movement, with a persistent breathing animation.
2. Migrate the Player view from the old vanilla JS PWA (`public/index.html` + `public/app.js`) to the React TypeScript app in `client/`, including audio-reactive linkage between the dots background and the music being played.

## Context

Phase 1 stood up the React shell (TopBar + TabNav + ViewContainer + 4 placeholder views) with `InteractiveDots` as a full-screen background. However, the dots were invisible on page load — `MIN_W = 0` meant dots far from the cursor (initial position `(0,0)`) shrunk to radius 0, and `opacity = 0.45` on already-tiny dots made them imperceptible. The visualizer in the old PWA (`<div class="visualizer">` with 40 `<span>` bars driven by `setInterval(Math.random())`) had no connection to the dots background.

This spec redesigns the dots to be visible, interactive, and audio-reactive, then migrates the full Player view logic out of the old PWA into React.

## Decisions

1. **Dots visible at all times:** `MIN_W` changed from `0` to `ACTUAL_W * 0.15`. Initial `mousePos` set to center of viewport. Default `dotSize` raised to 30.
2. **Two-tier opacity:** `baseOpacity` (default `0.35`) for distant points; `peakOpacity` (default `0.85`) for points near the cursor. Replaces single `opacity` prop.
3. **Breathing animation:** All dots oscillate at ~4s period when no audio is playing (amplitude ±15% of current radius).
4. **Audio-reactive mode:** When `audioAnalyser` is supplied and audio is active, dots respond to 3 frequency bands:
   - Low (bass): scales overall dot radius (0.8x–1.6x)
   - Mid (vocals): scales mouse-proximity gather amplitude
   - High (treble): scales noise jitter amplitude
5. **Player migration:** One React component per UI unit. State centralized in `useClaudio` hook. Audio analyser created inside the hook and passed down to `InteractiveDots` via App.tsx.
6. **Old PWA untouched:** Views remain at `/` during this phase; React app at `/react`. No changes to `public/` files or `server.js` routing logic.

## Architecture

### New / modified files

```
client/src/
├── App.tsx                          # modified — passes audioAnalyser to InteractiveDots
├── components/
│   ├── ui/
│   │   └── interactive-dots.tsx    # refactored — two-tier opacity, breathing, audio-reactive
│   ├── shell/                       # unchanged
│   ├── player/                      # NEW
│   │   ├── TrackInfo.tsx            # cover placeholder + song name + artist
│   │   ├── ProgressBar.tsx          # draggable range input + time display
│   │   ├── DJSay.tsx                # DJ text + replay TTS button
│   │   ├── FeedbackBar.tsx          # like / neutral / dislike buttons
│   │   └── PlayControls.tsx         # play/pause + next song
│   └── chat/                        # NEW
│       ├── ChatHistory.tsx          # scrollable message list
│       ├── ChatInput.tsx            # text input + quick-action phrases
│       └── ChatMessage.tsx          # single message bubble
├── hooks/
│   └── useClaudio.ts               # NEW — WebSocket + audio state + analyser
├── views/
│   └── PlayerView.tsx              # modified — real implementation
```

### InteractiveDots — refactored props

```typescript
interface InteractiveDotsProps {
  dotColor?: string           // default "#d4a853"
  dotSize?: number            // default 30
  baseOpacity?: number        // default 0.35 — opacity at furthest distance
  peakOpacity?: number        // default 0.85 — opacity at cursor proximity
  audioAnalyser?: AnalyserNode // optional — when present, enables audio-reactive mode
  className?: string
}
```

### InteractiveDots — rendering model

**Two visual layers per dot:**

1. **Base layer** (`baseOpacity`): Every dot always draws at ≥ `ACTUAL_W * 0.15` radius regardless of cursor distance. Controlled by `opacity = baseOpacity`.
2. **Proximity glow** (`peakOpacity - baseOpacity`): The additional radius and brightness from cursor proximity. Computed as:
   ```
   proximityFactor = clamp(1 - delta / (GREATER / 2), 0, 1)
   dynamicRadius = baseRadius + (ACTUAL_W - baseRadius) * proximityFactor
   dynamicOpacity = baseOpacity + (peakOpacity - baseOpacity) * proximityFactor
   ```

**Breathing mode** (no audio):
```
breathAmount = 1 + 0.15 * sin(frameCount / 240 * 2π)  // ~4s period at 60fps
finalRadius = dynamicRadius * breathAmount
```

**Audio-reactive mode** (audioAnalyser present and active):
```
[bass, mid, high] = getByteFrequencyData() → band averages
radiusScale   = map(bass,  0, 255, 0.8, 1.6)
proximityGain = map(mid,   0, 255, 0.3, 1.0)
jitterAmount  = map(high,  0, 255, 0.5, 2.0)

finalRadius = dynamicRadius * radiusScale
noiseAmplitude *= jitterAmount
proximityFactor = proximityFactor * proximityGain
```

**Initial mouse position:** `{ x: window.innerWidth / 2, y: window.innerHeight / 2 }` — dots spread from center on page load.

**Mouse interaction:** As cursor moves near a dot, the dot expands from `baseRadius` toward `ACTUAL_W` and brightens from `baseOpacity` toward `peakOpacity`. A per-dot decay timer (~300ms) smooths the falloff when the cursor moves away.

### useClaudio hook

```typescript
interface ClaudioState {
  // Playback
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number

  // DJ
  djText: string
  currentTTS: string | null
  
  // Feedback
  feedback: 'like' | 'neutral' | 'dislike' | null
  
  // Chat
  messages: ChatMessage[]

  // Audio analysis
  audioAnalyser: AnalyserNode | null
  isAudioActive: boolean

  // Actions
  play: () => void
  pause: () => void
  next: () => void
  seek: (time: number) => void
  replayTTS: () => void
  submitFeedback: (type: 'like' | 'neutral' | 'dislike') => Promise<void>
  sendChat: (text: string) => void
}
```

**Lifecycle:**
1. On mount: connect to WebSocket at `/stream`
2. On first user-interaction (play click): create `AudioContext` + `AnalyserNode` from `<audio>` element
3. On `ws message`: parse and dispatch to state updates
4. On unmount: close WebSocket, clean up AudioContext

**Audio path:**
- TTS → `<audio id="tts-audio">` → onended → switch to song `<audio id="song-audio">`
- Song `<audio>` → `MediaElementSourceNode` → `AnalyserNode` → `audioAnalyser` state
- Dots read `audioAnalyser.getByteFrequencyData()` in their render loop

### State ownership

```
App.tsx
  useClaudio() → { analyser, track, ... }
    ├── InteractiveDots   ← reads analyser (but doesn't own it)
    └── PlayerView        ← reads player state + actions
          ├── TrackInfo       ← currentTrack
          ├── ProgressBar     ← currentTime, duration, seek()
          ├── DJSay           ← djText, replayTTS()
          ├── FeedbackBar     ← feedback, submitFeedback()
          ├── PlayControls    ← isPlaying, play(), pause(), next()
          └── ChatHistory + ChatInput ← messages, sendChat()
```

### PlayerView layout (top to bottom)

```
┌──────────────────────────────┐
│  TrackInfo (cover + name + artist)  │
├──────────────────────────────┤
│  FeedbackBar (like | neutral | dislike) │
├──────────────────────────────┤
│  ProgressBar (range + times) │
├──────────────────────────────┤
│  DJSay (text + replay btn)   │
├──────────────────────────────┤
│  PlayControls (play/pause + next)  │
├──────────────────────────────┤
│  ChatHistory                 │
│  ChatInput + quick actions   │
└──────────────────────────────┘
```

The old visualizer div (40 random bars) is **removed** — replaced by dots' audio-reactivity.

## Error handling

- **WebSocket disconnect:** auto-reconnect with 3s backoff. UI shows "离线" badge in TopBar.
- **AudioContext blocked:** `AudioContext` is created in response to a user click. If `audioContext.state === 'suspended'`, call `audioContext.resume()`.
- **`getByteFrequencyData` throws:** catch inside rAF, fall back to breathing mode.
- **Song load failure:** show error status, retry via `/api/stream?id=` re-resolution.
- **TTS load failure:** skip directly to song playback.

## Testing

- **InteractiveDots refactor:** smoke test canvas render, prop acceptance, canvas 2D null-path (jsdom).
- **Player sub-components:** each renders with mock props, fires callbacks on interaction.
- **useClaudio:** mock WebSocket to test auto-reconnect, message parsing, state transitions.
- **PlayerView integration:** render with mock hook, verify all sub-components are present.
- All existing tests (utils, shell, App) must continue to pass.

## Out of scope

- HistoryView, ProfileView, SettingsView migration (separate specs after Player is done).
- Repointing `/` to the React app; retiring `public/`.
- PWA service worker / manifest migration.
- Adding authentication or user accounts.
- Real album cover art (placeholder gradient only).

## Breaking change from Phase 1

- `InteractiveDots` prop `opacity` is **removed**. Replaced by `baseOpacity` (default `0.35`) and `peakOpacity` (default `0.85`).
- `App.tsx` must update: `<InteractiveDots dotColor="#d4a853" dotSize={20} opacity={0.45} />` → `<InteractiveDots dotColor="#d4a853" dotSize={30} />` initially, then add `audioAnalyser` from `useClaudio` once the hook is integrated.

## Global constraints

- Same tech stack: React 18.3, TypeScript 5.5, Vite 5.3, Tailwind 3.4, Vitest 1.6.
- `base: '/react/'` in Vite config unchanged.
- Backend `server.js` unchanged — `/react` mount already in place.
- Old PWA at `/` untouched.
- Dots default color `#d4a853`.
- Port 8080 is occupied by another service; backend port configurable via `PORT=3001` in `.env`. Vite dev server port: `server.port` in `vite.config.ts` must change from `5173` to a free port (e.g. `3002`); proxy targets must match the backend port (e.g. `http://localhost:3001`).
