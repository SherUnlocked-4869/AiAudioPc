# React Dots Background (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Vite + React + TS + Tailwind + shadcn frontend in `client/`, integrate `InteractiveDots` as a unified full-screen gold low-opacity background behind an app shell with 4 placeholder views, and serve the build from Express at `/react` while the old vanilla JS PWA stays at `/`.

**Architecture:** New `client/` Vite SPA (`base: '/react/'`) sits beside the existing Express backend. Dev uses Vite `:5173` proxying `/api` and `/stream` to Express `:8080`; prod builds to `client/dist/` which Express serves at `/react` with an SPA fallback. The dots component is a fixed `-z-10` full-screen canvas; the shell (TopBar + TabNav + ViewContainer) renders above it.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Tailwind 3, shadcn (config only), Vitest 1 + jsdom + React Testing Library + @testing-library/user-event. Backend unchanged (Express + ws).

## Global Constraints

- React `^18.3.1`, TypeScript `^5.5.3`, Vite `^5.3.4`, Tailwind `^3.4.x`, Vitest `^1.6.0`.
- Vite `base` MUST be `'/react/'`.
- Express MUST serve the React build at `/react` *after* the existing `/api`, `/user`, `/prompts`, `/cache/tts` mounts.
- Dots default color `#d4a853`, default opacity `0.45`.
- `audioAnalyser` prop is declared in the `InteractiveDots` props interface but NOT destructured/used in Phase 1 (avoids unused-var errors; reserves the hook for Phase 2).
- No changes to `server.js` WebSocket logic, `/api` routes, or any file under `public/`.
- Project runs on Windows (PowerShell 7+); npm is the package manager. Run `client/` npm commands from inside `client/` (use `workdir`).
- `client/node_modules/` is already covered by the root `.gitignore` `node_modules/` rule; `client/dist/` must be added to `.gitignore`.

**Reference spec:** `docs/superpowers/specs/2026-06-20-react-dots-background-design.md`

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `client/package.json` | deps + scripts (dev/build/test) | 1 |
| `client/vite.config.ts` | Vite + React plugin, `base`, alias `@`, dev proxy, vitest config | 1, 2 |
| `client/tsconfig.json` | TS compiler options, `@/*` path alias | 1 |
| `client/tsconfig.node.json` | TS config for `vite.config.ts` | 1 |
| `client/index.html` | Vite HTML entry | 1 |
| `client/src/main.tsx` | React root mount | 1 |
| `client/src/App.tsx` | Shell assembly: dots background + shell + tab state | 1, 5 |
| `.gitignore` | add `client/dist/` | 1 |
| `client/tailwind.config.js` | Tailwind theme tokens (Clastic colors) | 2 |
| `client/postcss.config.js` | PostCSS tailwind + autoprefixer | 2 |
| `client/src/index.css` | Tailwind directives + `:root` CSS vars + base styles | 2 |
| `client/components.json` | shadcn config (alias `@/components`, `@/lib/utils`) | 2 |
| `client/src/lib/utils.ts` | `cn()` class merge helper | 2 |
| `client/src/test/setup.ts` | vitest + jest-dom/vitest setup | 2 |
| `client/src/components/ui/interactive-dots.tsx` | canvas dots background (mouse + reserved audio) | 3 |
| `client/src/components/shell/TopBar.tsx` | title + subtitle + connection dot | 4 |
| `client/src/components/shell/TabNav.tsx` | tab buttons + `Tab` type + active state | 4 |
| `client/src/components/shell/ViewContainer.tsx` | active id → view mapping | 4 |
| `client/src/views/PlayerView.tsx` | placeholder card | 4 |
| `client/src/views/HistoryView.tsx` | placeholder card | 4 |
| `client/src/views/ProfileView.tsx` | placeholder card | 4 |
| `client/src/views/SettingsView.tsx` | placeholder card | 4 |
| `server.js` | serve `client/dist` at `/react` + SPA fallback | 6 |
| `package.json` (root) | `build:client` convenience script | 6 |
| `README.md` | document the `client/` app + dev/prod workflow | 7 |

---

## Task 1: Scaffold the Vite + React + TS app in `client/`

**Files:**
- Create: `client/package.json`
- Create: `client/vite.config.ts`
- Create: `client/tsconfig.json`
- Create: `client/tsconfig.node.json`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a runnable Vite dev server at `http://localhost:5173/react/` rendering "Claudio React (Phase 1)"; the `@` path alias resolves to `client/src/`; `npm run dev` / `npm run build` / `npm run preview` scripts exist.

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "claudio-client",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}
```

- [ ] **Step 2: Create `client/vite.config.ts`**

```ts
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
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/stream': { target: 'ws://localhost:8080', ws: true },
    },
  },
})
```

- [ ] **Step 3: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `client/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `client/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claudio · 个人 AI 电台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `client/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Note: `./index.css` does not exist yet (created in Task 2). The dev server will warn but still run for this task's verification; the import resolves once Task 2 lands. To keep Task 1 self-verifying without a missing-css error, create a temporary empty `client/src/index.css` now with a single comment, then Task 2 overwrites it with real content.

- [ ] **Step 7: Create `client/src/index.css` (temporary placeholder)**

```css
/* Tailwind directives + theme tokens added in Task 2 */
```

- [ ] **Step 8: Create `client/src/App.tsx`**

```tsx
export default function App() {
  return <div className="p-8">Claudio React (Phase 1)</div>
}
```

- [ ] **Step 9: Add `client/dist/` to `.gitignore`**

Append to the root `.gitignore` (after the existing `node_modules/` line):

```
# Vite build output
client/dist/
```

- [ ] **Step 10: Install dependencies**

Run (in `client/`):
```
npm install
```
Expected: installs React, React DOM, Vite, TypeScript, and plugin into `client/node_modules/`; creates `client/package-lock.json`.

- [ ] **Step 11: Verify the dev server runs**

Run (in `client/`):
```
npm run dev
```
Expected: Vite logs a line like `VITE v5.x  ready in ... ms` and `➜  Local:   http://localhost:5173/react/`. Open `http://localhost:5173/react/` in a browser; the page shows "Claudio React (Phase 1)". Stop the server (Ctrl+C) after verifying.

- [ ] **Step 12: Verify the production build works**

Run (in `client/`):
```
npm run build
```
Expected: `tsc -b` emits no errors, then `vite build` writes `client/dist/index.html` plus `client/dist/assets/...`. (Do not commit `client/dist/` — it is gitignored.)

- [ ] **Step 13: Commit**

```
git add client/package.json client/package-lock.json client/vite.config.ts client/tsconfig.json client/tsconfig.node.json client/index.html client/src/main.tsx client/src/index.css client/src/App.tsx .gitignore
git commit -m "feat(client): scaffold Vite + React + TS app in client/"
```

---

## Task 2: Tailwind + shadcn config + Claudio theme tokens + test infra

**Files:**
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Modify: `client/src/index.css` (replace placeholder with real content)
- Create: `client/components.json`
- Create: `client/src/lib/utils.ts`
- Create: `client/src/test/setup.ts`
- Modify: `client/vite.config.ts` (add `test` block)
- Test: `client/src/lib/utils.test.ts`

**Interfaces:**
- Consumes: `@` alias from Task 1
- Produces: Tailwind utilities `bg-bg`, `text-text`, `text-accent`, `text-muted`, `border-border`, `bg-panel`, etc. resolve against CSS vars; `cn(...inputs)` helper exported from `@/lib/utils`; a working Vitest + jsdom + React Testing Library setup (used by Tasks 3–5).

- [ ] **Step 1: Install Tailwind stack + cn deps + test deps**

Run (in `client/`):
```
npm install -D tailwindcss@3 postcss autoprefixer vitest@1 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install clsx tailwind-merge
```
Expected: Tailwind 3, PostCSS, autoprefixer, vitest 1, jsdom, and the three @testing-library packages added to devDependencies; clsx + tailwind-merge added to dependencies.

- [ ] **Step 2: Create `client/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Create `client/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        'panel-2': 'var(--panel-2)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-2': 'var(--accent-2)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        danger: 'var(--danger)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Replace `client/src/index.css` with real content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #0a0a0f;
  --panel: #12121a;
  --panel-2: #1a1a24;
  --border: #2a2a3a;
  --accent: #d4a853;
  --accent-2: #7d9e7e;
  --text: #e8e6e1;
  --muted: #8a8791;
  --danger: #c65d57;
}

html, body, #root {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", sans-serif;
}
```

- [ ] **Step 5: Create `client/components.json` (shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 6: Add the `test` block to `client/vite.config.ts`**

Replace the whole file with (adds the `/// <reference types="vitest" />` directive and a `test` field):

```ts
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
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/stream': { target: 'ws://localhost:8080', ws: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 7: Create `client/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 8: Write the failing test for `cn()`**

Create `client/src/lib/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges multiple class names into one string', () => {
    expect(cn('p-2', 'bg-red-500')).toBe('p-2 bg-red-500')
  })

  it('dedupes conflicting Tailwind classes, last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('handles falsy values', () => {
    expect(cn('p-2', false, null, undefined, 'bg-red-500')).toBe('p-2 bg-red-500')
  })
})
```

- [ ] **Step 9: Run the test to verify it fails**

Run (in `client/`):
```
npx vitest run src/lib/utils.test.ts
```
Expected: FAIL — `cn` is not exported / module `@/lib/utils` not found (vitest is already installed from Step 1, so this runs cleanly and reports the import failure rather than prompting to install).

- [ ] **Step 10: Create `client/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 11: Run the test to verify it passes**

Run (in `client/`):
```
npx vitest run src/lib/utils.test.ts
```
Expected: PASS — 3 tests pass for `cn`.

- [ ] **Step 12: Verify Tailwind classes apply in the dev server**

Temporarily edit `client/src/App.tsx` to use theme utilities, run the dev server, and confirm styling renders:

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-bg p-8">
      <h1 className="text-3xl font-light tracking-widest text-accent">Claudio React (Phase 1)</h1>
      <p className="text-muted">theme tokens test</p>
    </div>
  )
}
```

Run (in `client/`): `npm run dev`
Expected: `http://localhost:5173/react/` shows a dark (`#0a0a0f`) page with gold (`#d4a853`) heading and muted-grey subtitle. Stop the server after verifying.

- [ ] **Step 13: Commit**

```
git add client/package.json client/package-lock.json client/tailwind.config.js client/postcss.config.js client/src/index.css client/components.json client/src/lib/utils.ts client/src/lib/utils.test.ts client/src/test/setup.ts client/vite.config.ts client/src/App.tsx
git commit -m "feat(client): add Tailwind, shadcn config, theme tokens, cn() helper, test infra"
```

---

## Task 3: The `InteractiveDots` background component

**Files:**
- Create: `client/src/components/ui/interactive-dots.tsx`
- Test: `client/src/components/ui/interactive-dots.test.tsx`

**Interfaces:**
- Consumes: React, the `@` alias, Vitest+RTL from Task 2
- Produces: `InteractiveDots` named export from `@/components/ui/interactive-dots` with props `{ dotColor?: string; dotSize?: number; opacity?: number; audioAnalyser?: AnalyserNode; className?: string }`. Renders a `<canvas>` filling the viewport. In jsdom (null canvas context) the effect returns early — no crash, no runaway `requestAnimationFrame`.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/ui/interactive-dots.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { InteractiveDots } from '@/components/ui/interactive-dots'

describe('InteractiveDots', () => {
  it('renders a canvas element', () => {
    const { container } = render(<InteractiveDots />)
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('accepts custom dotColor, dotSize and opacity props without throwing', () => {
    const { container } = render(
      <InteractiveDots dotColor="#ff0000" dotSize={12} opacity={0.5} />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('accepts an audioAnalyser prop (reserved) without throwing', () => {
    const { container } = render(
      <InteractiveDots audioAnalyser={undefined} />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (in `client/`):
```
npx vitest run src/components/ui/interactive-dots.test.tsx
```
Expected: FAIL — module `@/components/ui/interactive-dots` not found.

- [ ] **Step 3: Create `client/src/components/ui/interactive-dots.tsx`**

```tsx
"use client"

import { useEffect, useRef } from "react"

interface InteractiveDotsProps {
  dotColor?: string
  dotSize?: number
  opacity?: number
  audioAnalyser?: AnalyserNode
  className?: string
}

export function InteractiveDots({
  dotColor = "#d4a853",
  dotSize = 20,
  opacity = 0.45,
  className = "",
}: InteractiveDotsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePos = useRef({ x: 0, y: 0 })
  const frameCountRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    const CIRCLE_W = dotSize
    const ACTUAL_W = CIRCLE_W * 0.72
    const MIN_W = 0
    const CIRCLE_DIST = CIRCLE_W / 2
    const COLS = Math.ceil(canvas.width / CIRCLE_DIST) + 1
    const ROWS = Math.ceil(canvas.height / CIRCLE_DIST) + 1
    const GREATER = Math.max(canvas.width, canvas.height)

    const noise = (x: number, y: number, z: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453
      return n - Math.floor(n)
    }

    class Dot {
      position: { x: number; y: number }

      constructor(posX: number, posY: number) {
        this.position = { x: posX, y: posY }
      }

      calcWidth(): number {
        const dx = mousePos.current.x - this.position.x
        const dy = mousePos.current.y - this.position.y
        let delta = Math.sqrt(dx * dx + dy * dy)

        const noiseVal = noise(this.position.x, this.position.y, frameCountRef.current)
        const noiseMap = 0.7 + noiseVal * 0.5
        delta *= noiseMap

        if (delta > GREATER / 2) {
          delta = GREATER / 2
        }

        return ACTUAL_W - (delta / (GREATER / 2)) * (ACTUAL_W - MIN_W)
      }

      render() {
        const w = this.calcWidth()
        ctx!.fillStyle = dotColor
        ctx!.beginPath()
        ctx!.arc(this.position.x, this.position.y, w / 2, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    const dots: Dot[] = []
    for (let ci = 0; ci < COLS; ci++) {
      for (let ri = 0; ri < ROWS; ri++) {
        dots.push(new Dot(ci * CIRCLE_DIST, ri * CIRCLE_DIST))
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("touchmove", handleTouchMove)

    const animate = () => {
      ctx!.globalAlpha = opacity
      ctx!.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach((dot) => dot.render())
      frameCountRef.current++
      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchmove", handleTouchMove)
    }
  }, [dotColor, dotSize, opacity])

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full h-screen ${className}`}
      style={{ display: "block", background: "transparent" }}
    />
  )
}
```

Note: `audioAnalyser` is declared in `InteractiveDotsProps` but intentionally NOT destructured — this reserves it for Phase 2 without triggering `noUnusedParameters`/`noUnusedLocals`.

- [ ] **Step 4: Run the test to verify it passes**

Run (in `client/`):
```
npx vitest run src/components/ui/interactive-dots.test.tsx
```
Expected: PASS — 3 tests pass. (In jsdom `canvas.getContext` returns `null`, so the effect hits `if (!ctx) return` before adding listeners or starting the rAF loop — no hang.)

- [ ] **Step 5: Typecheck the whole project**

Run (in `client/`):
```
npx tsc -b
```
Expected: no errors. (Confirms `noUnusedLocals`/`noUnusedParameters` are satisfied even with the reserved `audioAnalyser` prop.)

- [ ] **Step 6: Commit**

```
git add client/src/components/ui/interactive-dots.tsx client/src/components/ui/interactive-dots.test.tsx
git commit -m "feat(client): add InteractiveDots canvas background component"
```

---

## Task 4: App shell components + placeholder views

**Files:**
- Create: `client/src/components/shell/TopBar.tsx`
- Create: `client/src/components/shell/TabNav.tsx`
- Create: `client/src/components/shell/ViewContainer.tsx`
- Create: `client/src/views/PlayerView.tsx`
- Create: `client/src/views/HistoryView.tsx`
- Create: `client/src/views/ProfileView.tsx`
- Create: `client/src/views/SettingsView.tsx`
- Test: `client/src/components/shell/TabNav.test.tsx`
- Test: `client/src/components/shell/ViewContainer.test.tsx`

**Interfaces:**
- Consumes: `cn()` from `@/lib/utils` (Task 2)
- Produces:
  - `TopBar` from `@/components/shell/TopBar` — props `{ online?: boolean }` (default `false`).
  - `TabNav` from `@/components/shell/TabNav` — props `{ tabs: Tab[]; activeId: string; onTabChange: (id: string) => void }`; exports `type Tab = { id: string; label: string }`.
  - `ViewContainer` from `@/components/shell/ViewContainer` — props `{ active: string }`; maps id → view, falls back to `PlayerView`.
  - Four view components from `@/views/*` — no props; each renders a card with an uppercase label, an `<h2>` of the view name, and "待迁移 — Phase 2".

- [ ] **Step 1: Write the failing test for `TabNav`**

Create `client/src/components/shell/TabNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TabNav, type Tab } from '@/components/shell/TabNav'

const tabs: Tab[] = [
  { id: 'player', label: 'Player' },
  { id: 'history', label: 'History' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
]

describe('TabNav', () => {
  it('renders all four tab labels as buttons', () => {
    render(<TabNav tabs={tabs} activeId="player" onTabChange={() => {}} />)
    for (const t of tabs) {
      expect(screen.getByRole('button', { name: t.label })).toBeInTheDocument()
    }
  })

  it('marks the active tab with aria-selected="true"', () => {
    render(<TabNav tabs={tabs} activeId="profile" onTabChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Player' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onTabChange with the clicked tab id', async () => {
    const onTabChange = vi.fn()
    render(<TabNav tabs={tabs} activeId="player" onTabChange={onTabChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(onTabChange).toHaveBeenCalledWith('history')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (in `client/`):
```
npx vitest run src/components/shell/TabNav.test.tsx
```
Expected: FAIL — module `@/components/shell/TabNav` not found.

- [ ] **Step 3: Create `client/src/components/shell/TabNav.tsx`**

```tsx
import { cn } from '@/lib/utils'

export interface Tab {
  id: string
  label: string
}

interface TabNavProps {
  tabs: Tab[]
  activeId: string
  onTabChange: (id: string) => void
}

export function TabNav({ tabs, activeId, onTabChange }: TabNavProps) {
  return (
    <nav className="my-4 flex gap-2">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex-1 cursor-pointer rounded-lg border px-3 py-3 transition-colors',
              active
                ? 'border-accent bg-panel-2 text-accent'
                : 'border-border bg-panel text-muted',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Run the `TabNav` test to verify it passes**

Run (in `client/`):
```
npx vitest run src/components/shell/TabNav.test.tsx
```
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Create the four placeholder views**

Create `client/src/views/PlayerView.tsx`:

```tsx
export function PlayerView() {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-panel p-4">
      <div className="mb-3 text-xs uppercase tracking-widest text-accent">PLAYER</div>
      <h2 className="text-lg font-semibold text-text">Player</h2>
      <p className="text-muted">待迁移 — Phase 2</p>
    </section>
  )
}
```

Create `client/src/views/HistoryView.tsx`:

```tsx
export function HistoryView() {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-panel p-4">
      <div className="mb-3 text-xs uppercase tracking-widest text-accent">HISTORY</div>
      <h2 className="text-lg font-semibold text-text">History</h2>
      <p className="text-muted">待迁移 — Phase 2</p>
    </section>
  )
}
```

Create `client/src/views/ProfileView.tsx`:

```tsx
export function ProfileView() {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-panel p-4">
      <div className="mb-3 text-xs uppercase tracking-widest text-accent">PROFILE</div>
      <h2 className="text-lg font-semibold text-text">Profile</h2>
      <p className="text-muted">待迁移 — Phase 2</p>
    </section>
  )
}
```

Create `client/src/views/SettingsView.tsx`:

```tsx
export function SettingsView() {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-panel p-4">
      <div className="mb-3 text-xs uppercase tracking-widest text-accent">SETTINGS</div>
      <h2 className="text-lg font-semibold text-text">Settings</h2>
      <p className="text-muted">待迁移 — Phase 2</p>
    </section>
  )
}
```

- [ ] **Step 6: Write the failing test for `ViewContainer`**

Create `client/src/components/shell/ViewContainer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ViewContainer } from '@/components/shell/ViewContainer'

describe('ViewContainer', () => {
  it('renders the Player heading when active is "player"', () => {
    render(<ViewContainer active="player" />)
    expect(screen.getByRole('heading', { name: 'Player', level: 2 })).toBeInTheDocument()
  })

  it('renders the History heading when active is "history"', () => {
    render(<ViewContainer active="history" />)
    expect(screen.getByRole('heading', { name: 'History', level: 2 })).toBeInTheDocument()
  })

  it('renders the Settings heading when active is "settings"', () => {
    render(<ViewContainer active="settings" />)
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeInTheDocument()
  })

  it('falls back to Player when the id is unknown', () => {
    render(<ViewContainer active="nope" />)
    expect(screen.getByRole('heading', { name: 'Player', level: 2 })).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run the test to verify it fails**

Run (in `client/`):
```
npx vitest run src/components/shell/ViewContainer.test.tsx
```
Expected: FAIL — module `@/components/shell/ViewContainer` not found.

- [ ] **Step 8: Create `client/src/components/shell/ViewContainer.tsx`**

```tsx
import type { FC } from 'react'
import { PlayerView } from '@/views/PlayerView'
import { HistoryView } from '@/views/HistoryView'
import { ProfileView } from '@/views/ProfileView'
import { SettingsView } from '@/views/SettingsView'

const VIEWS: Record<string, FC> = {
  player: PlayerView,
  history: HistoryView,
  profile: ProfileView,
  settings: SettingsView,
}

export function ViewContainer({ active }: { active: string }) {
  const View = VIEWS[active] ?? PlayerView
  return <View />
}
```

- [ ] **Step 9: Run the `ViewContainer` test to verify it passes**

Run (in `client/`):
```
npx vitest run src/components/shell/ViewContainer.test.tsx
```
Expected: PASS — 4 tests pass.

- [ ] **Step 10: Create `client/src/components/shell/TopBar.tsx`**

```tsx
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
```

- [ ] **Step 11: Typecheck the whole project**

Run (in `client/`):
```
npx tsc -b
```
Expected: no errors.

- [ ] **Step 12: Commit**

```
git add client/src/components/shell/TopBar.tsx client/src/components/shell/TabNav.tsx client/src/components/shell/TabNav.test.tsx client/src/components/shell/ViewContainer.tsx client/src/components/shell/ViewContainer.test.tsx client/src/views/PlayerView.tsx client/src/views/HistoryView.tsx client/src/views/ProfileView.tsx client/src/views/SettingsView.tsx
git commit -m "feat(client): add app shell (TopBar, TabNav, ViewContainer) + placeholder views"
```

---

## Task 5: Assemble `App.tsx` — dots background + shell

**Files:**
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx`

**Interfaces:**
- Consumes: `InteractiveDots` (Task 3), `TopBar` / `TabNav` / `ViewContainer` (Task 4)
- Produces: the root `App` that renders a fixed full-screen `InteractiveDots` behind a centered shell; tab state lives in `App`; clicking a tab switches the active view. Default tab is `player`.

- [ ] **Step 1: Write the failing test**

Create `client/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('renders the dots canvas and the Claudio title', () => {
    const { container } = render(<App />)
    expect(container.querySelector('canvas')).not.toBeNull()
    expect(screen.getByText('Claudio')).toBeInTheDocument()
  })

  it('shows the Player view heading by default', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Player', level: 2 })).toBeInTheDocument()
  })

  it('switches to the Settings view when the Settings tab is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Player', level: 2 })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (in `client/`):
```
npx vitest run src/App.test.tsx
```
Expected: FAIL — `App` still renders the old "Claudio React (Phase 1)" string from Task 2 Step 13; no canvas, no Player heading. (At least the first assertion fails.)

- [ ] **Step 3: Replace `client/src/App.tsx` with the assembled shell**

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
        <InteractiveDots dotColor="#d4a853" dotSize={20} opacity={0.45} />
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

- [ ] **Step 4: Run the `App` test to verify it passes**

Run (in `client/`):
```
npx vitest run src/App.test.tsx
```
Expected: PASS — 3 tests pass. (Canvas exists; Player heading present by default; clicking Settings swaps the heading.)

- [ ] **Step 5: Run the full test suite**

Run (in `client/`):
```
npm test
```
Expected: PASS — all tests across `utils`, `interactive-dots`, `TabNav`, `ViewContainer`, and `App` pass.

- [ ] **Step 6: Typecheck**

Run (in `client/`):
```
npx tsc -b
```
Expected: no errors.

- [ ] **Step 7: Verify visually in the dev server**

Run (in `client/`): `npm run dev`
Expected: `http://localhost:5173/react/` shows the gold dot grid covering the viewport behind a centered TopBar ("Claudio" + subtitle + "● 离线"), 4 tabs, and the Player placeholder card. Moving the mouse makes nearby dots cluster. Clicking each tab swaps the card while the dots background stays fixed across all views. Stop the server after verifying.

- [ ] **Step 8: Commit**

```
git add client/src/App.tsx client/src/App.test.tsx
git commit -m "feat(client): assemble dots background + app shell in App.tsx"
```

---

## Task 6: Serve the React build from Express at `/react`

**Files:**
- Modify: `server.js` (add static mount + SPA fallback after the existing `/api` mount)
- Modify: `package.json` (root — add `build:client` script)

**Interfaces:**
- Consumes: `client/dist/` produced by `npm run build` (Task 1's build script)
- Produces: in production, `http://localhost:8080/react/` serves the React app; `http://localhost:8080/` still serves the old vanilla JS PWA. The `/api`, `/user`, `/prompts`, `/cache/tts` routes keep priority.

- [ ] **Step 1: Add the `build:client` script to the root `package.json`**

In `package.json`, add one entry to `scripts` (keep existing scripts intact):

```json
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js",
    "build:client": "npm --prefix client run build",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
```

- [ ] **Step 2: Build the client**

Run (in repo root):
```
npm run build:client
```
Expected: runs `tsc -b && vite build` in `client/`; writes `client/dist/index.html` and `client/dist/assets/...`. (Gitignored — do not commit.)

- [ ] **Step 3: Add the static mount + SPA fallback to `server.js`**

In `server.js`, immediately AFTER the line `app.use('/api', createRoutes(brain));` (line 33) and BEFORE the `/health` route, insert:

```js
// React 前端（Phase 1）：构建产物在 client/dist，挂在 /react，不影响旧 PWA 的 /
app.use('/react', express.static(path.join(__dirname, 'client/dist'), staticOptions));
app.get(['/react', '/react/*'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});
```

The `staticOptions` (defined earlier in `server.js`) and `path` (already imported at the top) are reused. The static mount serves real built assets; the GET catch-all serves `index.html` for any non-file sub-path (SPA fallback). Place after `/api` so API routes keep priority.

- [ ] **Step 4: Start the server and verify the old app still works**

Run (in repo root):
```
npm start
```
Expected: logs `[claudio] server running at http://localhost:8080`. Open `http://localhost:8080/` — the existing vanilla JS PWA loads as before (no regression). Leave the server running for Step 5.

- [ ] **Step 5: Verify the React app is served at `/react`**

With the server still running from Step 4, open `http://localhost:8080/react/` in a browser.
Expected: the React app loads — gold dot grid background, Claudio TopBar, 4 tabs, Player placeholder. (Asset URLs resolve under `/react/assets/...`.) Clicking tabs swaps views; the dots stay fixed. Confirm `http://localhost:8080/api/now` still returns JSON (no route shadowing). Stop the server (Ctrl+C) after verifying.

- [ ] **Step 6: Commit**

```
git add server.js package.json
git commit -m "feat(server): serve React build at /react with SPA fallback"
```

---

## Task 7: Document the `client/` app in the README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the workflow from Tasks 1–6
- Produces: a "React 前端 (Phase 1)" section explaining how to dev, build, and where the app is served.

- [ ] **Step 1: Add the section to `README.md`**

Insert this section after the "项目结构" section (after the project structure code block ends) and before "HTTP API":

```markdown
## React 前端（Phase 1）

新的 React + Vite + TypeScript + Tailwind + shadcn 前端位于 `client/`，与现有纯 JS PWA 并存：

- 旧 PWA 仍在根路径 `/`（`public/`），不受影响。
- React 构建产物挂在子路径 `/react`，dev 与 prod 均如此。

### 开发

```bash
# 1. 先启动后端（提供 /api 与 /stream）
npm start

# 2. 另开终端，启动 Vite dev server（:5173，自动代理 /api、/stream 到 :8080）
cd client
npm install
npm run dev
# 打开 http://localhost:5173/react/
```

### 生产构建

```bash
# 在仓库根目录
npm run build:client     # 等价于 cd client && npm run build → 输出 client/dist
npm start                # 访问 http://localhost:8080/react/
```

Phase 1 仅包含应用外壳（TopBar + 4 个占位视图）与全屏 `InteractiveDots` 背景效果；各视图逻辑将在后续阶段迁移。
```

- [ ] **Step 2: Commit**

```
git add README.md
git commit -m "docs: document client/ React frontend (Phase 1) workflow"
```

---

## Final verification

- [ ] **All client tests pass:** `cd client && npm test` — green.
- [ ] **Typecheck clean:** `cd client && npx tsc -b` — no errors.
- [ ] **Production build succeeds:** `npm run build:client` — `client/dist/index.html` written.
- [ ] **Old app unaffected:** `npm start` → `http://localhost:8080/` is the vanilla JS PWA.
- [ ] **React app served:** `http://localhost:8080/react/` shows dots background + shell; tabs switch views; mouse clusters dots; background persists across all 4 views.
- [ ] **No backend regressions:** `http://localhost:8080/api/now` and `http://localhost:8080/health` still return JSON.
- [ ] **Git history:** 7 task commits + 1 spec commit, each self-contained.
