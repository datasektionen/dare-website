import { useEffect, useRef } from "react"

type Flake = {
  x: number
  y: number
  z: number
  r: number
  ph: number
  ex: number
  ey: number
}

/**
 * Falling snow on a canvas that fills its parent. Flakes are pushed away from
 * the pointer and drift with its movement.
 */
export function Snow({
  density = 1,
  wind = 0.25,
  className,
}: {
  density?: number
  wind?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv?.getContext("2d")
    if (!cv || !ctx) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const sprite = document.createElement("canvas")
    sprite.width = sprite.height = 64
    const sg = sprite.getContext("2d")
    if (sg) {
      const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32)
      rg.addColorStop(0, "rgba(255,255,255,1)")
      rg.addColorStop(0.35, "rgba(255,255,255,.8)")
      rg.addColorStop(1, "rgba(255,255,255,0)")
      sg.fillStyle = rg
      sg.fillRect(0, 0, 64, 64)
    }

    const M = {
      x: -9999,
      y: -9999,
      vx: 0,
      vy: 0,
      lx: null as number | null,
      ly: 0,
    }
    let gust = 0
    let W = 0
    let H = 0
    let d = 1
    let flakes: Flake[] = []
    let last: number | undefined
    let raf = 0

    const mk = (anywhere: boolean): Flake => {
      const z = Math.random() ** 1.8 * 0.95 + 0.05
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -10,
        z,
        r: 0.8 + z * 3.6,
        ph: Math.random() * 6.28,
        ex: 0,
        ey: 0,
      }
    }

    const resize = () => {
      const r = cv.parentElement?.getBoundingClientRect()
      if (!r) return
      W = r.width
      H = r.height
      d = Math.min(devicePixelRatio || 1, 1.5)
      cv.width = W * d
      cv.height = H * d
      flakes = Array.from(
        { length: Math.round(((W * H) / 4200) * density) },
        () => mk(true)
      )
    }

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      if (M.lx != null) {
        M.vx = x - M.lx
        M.vy = y - M.ly
      }
      M.x = x
      M.y = y
      M.lx = x
      M.ly = y
    }
    const onLeave = () => {
      M.x = -9999
      M.y = -9999
      M.lx = null
    }

    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const dt = Math.min(0.05, (now - (last ?? now)) / 1000)
      last = now
      const t = now / 1000
      gust += (M.vx * 0.6 - gust) * 0.02
      M.vx *= 0.9
      M.vy *= 0.9
      const base = wind * 40
      ctx.setTransform(d, 0, 0, d, 0, 0)
      ctx.clearRect(0, 0, W, H)
      for (const f of flakes) {
        const dx = f.x - M.x
        const dy = f.y - M.y
        const dd = dx * dx + dy * dy
        const R = 150 * (0.5 + f.z)
        if (dd < R * R) {
          const dist = Math.sqrt(dd) || 1
          const k = 1 - dist / R
          f.ex += ((dx / dist) * 900 * dt + M.vx * 0.5) * k * f.z
          f.ey += ((dy / dist) * 900 * dt + M.vy * 0.5) * k * f.z
        }
        f.ex *= 0.95
        f.ey *= 0.95
        f.x +=
          ((base + gust * 8) * f.z +
            Math.sin(t * 0.9 + f.ph) * 14 * f.z +
            f.ex) *
          dt
        f.y += (18 + 62 * f.z + f.ey) * dt
        if (f.x > W + 20) f.x = -20
        if (f.x < -20) f.x = W + 20
        if (f.y > H + 12) {
          f.y = -12
          f.x = Math.random() * W
        }
        if (f.y < -14) f.y = H + 10
        const sz = f.r * (f.z > 0.85 ? 3.2 : 2.2)
        ctx.globalAlpha = 0.3 + 0.6 * f.z
        ctx.drawImage(sprite, f.x - sz / 2, f.y - sz / 2, sz, sz)
      }
    }

    addEventListener("pointermove", onMove)
    document.addEventListener("pointerleave", onLeave)
    addEventListener("resize", resize)
    resize()
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerleave", onLeave)
      removeEventListener("resize", resize)
    }
  }, [density, wind])

  return (
    <div className={className}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
      </div>
    </div>
  )
}
