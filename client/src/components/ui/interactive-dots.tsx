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
  const animationIdRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    const CIRCLE_W = dotSize
    const ACTUAL_W = CIRCLE_W * 0.72
    const MIN_W = ACTUAL_W * 0.15
    const CIRCLE_DIST = CIRCLE_W / 2

    let GRID_COLS = 0
    let GRID_ROWS = 0
    let columnHeights: number[] = []
    let columnDecays: number[] = []

    const noise = (x: number, y: number, z: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453
      return n - Math.floor(n)
    }

    class Dot {
      position: { x: number; y: number }
      col: number
      row: number
      decay: number

      constructor(col: number, row: number, posX: number, posY: number) {
        this.col = col
        this.row = row
        this.position = { x: posX, y: posY }
        this.decay = 0
      }

      calcWidth(): { radius: number; opacity: number } {
        // ── Mouse proximity (always active) ──
        const dx = mousePos.current.x - this.position.x
        const dy = mousePos.current.y - this.position.y
        let delta = Math.sqrt(dx * dx + dy * dy)

        const noiseVal = noise(this.position.x, this.position.y, frameCountRef.current)
        const noiseMap = 0.7 + noiseVal * 0.5
        delta *= noiseMap

        const MAX_INFLUENCE = 200
        if (delta > MAX_INFLUENCE) delta = MAX_INFLUENCE

        const rawProximity = 1 - delta / MAX_INFLUENCE
        const proximityFactor = Math.max(0, Math.min(1, rawProximity))

        const decaySpeed = 0.1
        this.decay += (proximityFactor - this.decay) * decaySpeed

        let opacity = baseOpacity + (peakOpacity - baseOpacity) * this.decay
        let radius = MIN_W + (ACTUAL_W - MIN_W) * this.decay

        // ── Audio bar boost (overlay on top of mouse) ──
        if (audioAnalyser && columnDecays.length > 0) {
          const barH = columnDecays[this.col] ?? 0
          const litRows = barH * GRID_ROWS
          const barTop = litRows - 1
          const distFromTop = barTop - this.row

          if (distFromTop >= 0 && litRows > 0) {
            const t = Math.min(1, distFromTop / litRows)
            const BAR_W = ACTUAL_W * 0.45
            const barAlpha = peakOpacity - (peakOpacity - baseOpacity) * t * 0.5
            const barRadius = BAR_W - (BAR_W - MIN_W) * t * 0.3
            opacity = Math.max(opacity, barAlpha)
            radius = Math.max(radius, barRadius)
          } else if (distFromTop > -3 && litRows > 0) {
            const f = (distFromTop + 3) / 3
            const glowAlpha = baseOpacity + (peakOpacity - baseOpacity) * f * 0.5
            opacity = Math.max(opacity, glowAlpha)
          }

          const n = noise(this.position.x, this.position.y, frameCountRef.current)
          opacity *= 0.9 + n * 0.2
          radius *= 0.95 + n * 0.1
        }

        const breathAmount = 1 + 0.15 * Math.sin((frameCountRef.current / 240) * Math.PI * 2)
        radius *= breathAmount

        return { radius: Math.max(0.5, radius), opacity: Math.max(0, Math.min(1, opacity)) }
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
      GRID_COLS = Math.ceil(canvas!.width / CIRCLE_DIST) + 1
      GRID_ROWS = Math.ceil(canvas!.height / CIRCLE_DIST) + 1
      columnDecays = new Array(GRID_COLS).fill(0)
      columnHeights = new Array(GRID_COLS).fill(0)
      dots = []
      for (let ci = 0; ci < GRID_COLS; ci++) {
        for (let ri = 0; ri < GRID_ROWS; ri++) {
          const rowFromBottom = GRID_ROWS - 1 - ri
          dots.push(new Dot(ci, rowFromBottom, ci * CIRCLE_DIST, ri * CIRCLE_DIST))
        }
      }
    }

    function updateColumnHeights() {
      if (!audioAnalyser) return
      try {
        const bufferLength = audioAnalyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        audioAnalyser.getByteFrequencyData(dataArray)

        const PAD_COLS = Math.floor(GRID_COLS * 0.12)
        const activeCols = GRID_COLS - PAD_COLS * 2

        for (let ci = 0; ci < GRID_COLS; ci++) {
          if (ci < PAD_COLS || ci >= GRID_COLS - PAD_COLS) {
            columnHeights[ci] = 0
            continue
          }
          const activeCi = ci - PAD_COLS
          const binStart = Math.floor((activeCi / activeCols) * bufferLength)
          const binEnd = Math.floor(((activeCi + 1) / activeCols) * bufferLength)
          let sum = 0
          const count = Math.max(1, binEnd - binStart)
          for (let i = binStart; i < binEnd; i++) {
            sum += dataArray[i]
          }
          columnHeights[ci] = sum / (count * 255)
        }

        const speed = 0.12
        for (let ci = 0; ci < GRID_COLS; ci++) {
          columnDecays[ci] += (columnHeights[ci] - columnDecays[ci]) * speed
        }
      } catch {}
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      rebuildDots()
    }
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

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
      mousePos.current = {
        x: mousePos.current.x + (mouseTarget.current.x - mousePos.current.x) * 0.08,
        y: mousePos.current.y + (mouseTarget.current.y - mousePos.current.y) * 0.08,
      }

      updateColumnHeights()
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
