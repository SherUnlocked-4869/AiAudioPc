# React Dots Background (Phase 1) — Design Spec

**Date:** 2026-06-20
**Status:** Approved for planning
**Supersedes / precedes:** This is Phase 1 of a phased frontend migration; later phases get their own specs.

## Goal

Stand up a Vite + React + TypeScript + Tailwind + shadcn frontend alongside the existing vanilla JS PWA, with the `InteractiveDots` canvas effect as a unified full-screen background behind an app shell with 4 placeholder views. The existing app at `/` stays fully working; the React app is served at `/react`. No view logic is migrated in this phase.

## Context

Claudio · 个人 AI 电台 is a Node.js + Express + WebSocket backend (`server.js`) serving a vanilla JS PWA from `public/` at `/` (port from `config.js`, default `8080`). The PWA has 4 views (Player / History / Profile / Settings), a dark theme (gold `#d4a853` / green `#7d9e7e` on `#0a0a0f`), and a bar visualizer. Backend API (`/api/*`) and WebSocket (`/stream`) are unchanged in this phase.

## Decisions

1. **Role:** `InteractiveDots` is a unified full-screen background visible across all 4 views.
2. **Tech stack:** Vite SPA + React 18 + TypeScript 5 + Tailwind 3 + shadcn (full React stack).
3. **Migration strategy:** Phased. Phase 1 = stack + background + shell with placeholder views. Phase 2+ (separate specs) migrates the 4 views' logic.
4. **Coexistence:** React app at `/react` (sub-path); old vanilla JS PWA stays at `/`. Vite `base: '/react/'`.
5. **Dots behavior:** Mouse-driven cluster/diffuse + reserved audio-pulse interface (`AnalyserNode` prop) that is **unused in Phase 1** (audio still plays in the old app). Phase 2 wires real audio.
6. **Dots color:** Gold `#d4a853` at low opacity (`~0.45`) so the background stays subtle and content readable.
7. **Phase 1 structure:** App shell (TopBar + TabNav + ViewContainer) + 4 placeholder view components. No real view logic.

## Architecture

### Project structure (new `client/` directory)

```
AiAudioPc/
├── client/                       # new Vite React app (Phase 1)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── components.json           # shadcn config
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               # shell assembly: dots background + shell
│   │   ├── index.css             # Tailwind directives + Claudio theme tokens
│   │   ├── test/setup.ts         # vitest + jest-dom setup
│   │   ├── lib/utils.ts          # cn() helper for shadcn
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   └── interactive-dots.tsx   # the dots background component
│   │   │   └── shell/
│   │   │       ├── TopBar.tsx
│   │   │       ├── TabNav.tsx
│   │   │       └── ViewContainer.tsx
│   │   └── views/
│   │       ├── PlayerView.tsx    # placeholder
│   │       ├── HistoryView.tsx   # placeholder
│   │       ├── ProfileView.tsx   # placeholder
│   │       └── SettingsView.tsx  # placeholder
│   └── dist/                     # Vite build output (gitignored)
├── public/                       # existing vanilla JS PWA — untouched
├── server.js                     # +serve client/dist at /react (Phase 1)
└── ...
```

### Serving & coexistence

- Vite `base: '/react/'` so all built asset URLs are sub-path-aware.
- **Dev:** Vite dev server on `:5173` with `proxy: { '/api': 'http://localhost:8080', '/stream': { target: 'ws://localhost:8080', ws: true } }` so the React dev server talks to the existing Express backend on `:8080`.
- **Prod:** `npm run build` (in `client/`) → `client/dist/`. Express gets one new static mount + an SPA fallback, placed *after* the existing `/api`, `/user`, `/prompts`, `/cache/tts` mounts so they keep priority.
- Old `public/` remains at `/`; React app at `/react`. When Phase 2 migration completes, `/` gets repointed to the React build and `public/` is retired.

### InteractiveDots component

`src/components/ui/interactive-dots.tsx`. Props:

- `dotColor?: string` — default `"#d4a853"`
- `dotSize?: number` — default `20`
- `opacity?: number` — default `0.45` (applied via `ctx.globalAlpha`)
- `audioAnalyser?: AnalyserNode` — reserved, optional. Declared in the props interface but **not destructured/used in Phase 1** (avoids unused-var errors and reserves the hook for Phase 2, where it will modulate dot size with frequency data).
- `className?: string`

Behavior: canvas fills viewport; grid of dots; each dot's radius shrinks with distance from the cursor (with simple noise variation); `requestAnimationFrame` loop; transparent background; resize/mousemove/touchmove listeners with cleanup. Identical algorithm to the provided component, plus the `opacity` (via `ctx.globalAlpha`) and the reserved `audioAnalyser` prop.

### App shell

- `TopBar`: "Claudio" title (h1) + subtitle + connection dot ("● 离线" by default; `online` prop toggles color).
- `TabNav`: 4 tabs (Player/History/Profile/Settings), active state via `aria-selected`, calls `onTabChange(id)` on click.
- `ViewContainer`: maps the active id to the matching placeholder view component; falls back to PlayerView for unknown ids.
- Placeholder views: each renders a card with an uppercase label, an `<h2>` with the view name, and "待迁移 — Phase 2".

### Theme

Tailwind config + `src/index.css` define CSS custom properties mirroring the old theme: `--bg #0a0a0f`, `--panel #12121a`, `--panel-2 #1a1a24`, `--border #2a2a3a`, `--accent #d4a853`, `--accent-2 #7d9e7e`, `--text #e8e6e1`, `--muted #8a8791`, `--danger #c65d57`. `tailwind.config.js` `theme.extend.colors` maps these (e.g. `bg: 'var(--bg)'`, `accent: 'var(--accent)'`, `border: 'var(--border)'`) so utilities like `bg-bg`, `text-accent`, `border-border` work.

## Error handling

- Canvas 2D context is `null` (e.g. jsdom) → effect returns early before setting up listeners or the animation loop; no crash, no runaway `requestAnimationFrame`.
- `resize` / `mousemove` / `touchmove` listeners are removed in the effect cleanup on unmount.
- Dot grid is recomputed on resize.

## Testing

- Vitest + jsdom + React Testing Library + @testing-library/user-event.
- `InteractiveDots`: smoke test — renders a `<canvas>`, accepts custom props, does not throw (canvas ctx is null in jsdom, exercising the early-return path).
- `cn()` helper: merges classes and dedupes conflicting Tailwind classes (last wins).
- `TabNav`: renders all 4 labels, calls `onTabChange` with the clicked id, marks the active tab via `aria-selected`.
- `ViewContainer`: renders the correct view heading for a given `active` id.
- `App`: renders the dots `<canvas>` plus the shell, and switches views when a tab is clicked.

## Out of scope (Phase 2+, separate specs)

- Migrating Player / History / Profile / Settings view logic.
- Wiring real audio (`AnalyserNode`) to the dots.
- Repointing `/` to the React app; retiring `public/`.
- PWA service worker / manifest for the React app.

## Global constraints

- React `^18.3.1`, TypeScript `^5.5.3`, Vite `^5.3.4`, Tailwind `^3.4.x`, Vitest `^1.6.0`.
- Vite `base` MUST be `'/react/'`.
- Express MUST serve the React build at `/react` *after* the existing `/api`, `/user`, `/prompts`, `/cache/tts` mounts.
- Dots default color `#d4a853`, default opacity `0.45`.
- `audioAnalyser` prop is declared but unused in Phase 1.
- No changes to `server.js` WebSocket logic, `/api` routes, or `public/` files.
- Project runs on Windows (PowerShell 7+); npm is the package manager.
