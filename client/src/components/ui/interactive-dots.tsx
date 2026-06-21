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
            const proximityFactor = mapRange(midAvg, 0, 255, 0.3, 1.0)
            const audioDecay = this.decay * proximityFactor

            finalRadius = (MIN_W + (ACTUAL_W - MIN_W) * audioDecay) * radiusScale * breathAmount
            finalOpacity = dynamicOpacity * mapRange(radiusScale, 0.8, 1.6, 0.7, 1.0)
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
