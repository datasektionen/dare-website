import type { Side } from "@/lib/battle/types"

/*
 * Drives the moving parts of the /battle screen in one animation loop:
 * - the fighters image, pushed towards the losing side with a spring, so
 *   every point overshoots a little like a real shove,
 * - screen shake on hits,
 * - a canvas with the lightning at the point where the gloves meet, sparks,
 *   shockwaves and drifting embers.
 * Only transforms are touched on DOM elements, so the browser composites
 * them without repainting.
 */

/** Where the gloves meet in the fighters image, as fractions of its size. */
const CLASH = { x: 0.513, y: 0.41 }
/** How far the fighters travel: at 100% share the clash is this far off centre. */
const REACH = 0.42
/** The image is 16:9 and covers the viewport. */
const ASPECT = 16 / 9

const COLORS: Record<Side, string[]> = {
  jaeger: ["#ff7a1a", "#ffb347", "#ff3d2e", "#ffe08a"],
  minttu: ["#3dd6ff", "#9eeaff", "#ffffff", "#5aa9ff"],
}

type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  decay: number
  size: number
  color: string
}
type Ring = { x: number; y: number; r: number; life: number; color: string }
type Ember = {
  x: number
  y: number
  vy: number
  drift: number
  size: number
  phase: number
  warm: boolean
}

export class BattleRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private raf = 0
  private last = 0
  private W = 0
  private H = 0
  private dpr = 1

  // Spring state for the fighters' horizontal offset, in px.
  private offset = 0
  private velocity = 0
  private target = 0
  private share = 0.5

  private shake = 0
  private flash = 0
  private flashColor = "#ffffff"
  private boltSeed = 0
  private boltTimer = 0
  private bolt: [number, number][] = []

  private sparks: Spark[] = []
  private rings: Ring[] = []
  private embers: Ember[] = []

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly fighters: HTMLElement,
    private readonly stage: HTMLElement,
    private readonly animate = true
  ) {
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D is not supported")
    this.ctx = ctx
  }

  start(share: number) {
    this.share = share
    this.resize()
    this.offset = this.target
    addEventListener("resize", this.resize)
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop)
      this.frame(now)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    removeEventListener("resize", this.resize)
  }

  /** Jäger's share of the votes, in [0, 1]. */
  setShare(share: number) {
    this.share = share
    this.target = this.targetFor(share)
  }

  /** A point for `side`: shove, sparks, shockwave and shake. */
  hit(side: Side, big = false) {
    const { x, y } = this.clash()
    const dir = side === "jaeger" ? 1 : -1
    // Extra shove in the direction of the hit, on top of the spring.
    this.velocity += dir * this.W * (big ? 1.6 : 0.9)
    this.shake = Math.min(1, this.shake + (big ? 1 : 0.6))
    this.flash = big ? 1 : 0.55
    this.flashColor = COLORS[side][0]
    this.boltTimer = 0
    const colors = COLORS[side]
    const n = big ? 140 : 70
    for (let i = 0; i < n; i++) {
      // Mostly towards the side being hit, fanning out.
      const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * Math.PI * 1.3
      const speed = (0.25 + Math.random() * 0.9) * this.H * (big ? 1.5 : 1)
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - this.H * 0.15,
        life: 1,
        decay: 0.7 + Math.random() * 1.1,
        size: (1 + Math.random() * 2.5) * this.dpr,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }
    this.rings.push({ x, y, r: 0, life: 1, color: colors[0] })
    if (big) this.rings.push({ x, y, r: 0, life: 1.3, color: "#ffffff" })
  }

  /** Both corners explode, for a reset. */
  reset() {
    this.flash = 1
    this.flashColor = "#ffffff"
    this.shake = 1
    this.hit("jaeger", true)
    this.hit("minttu", true)
  }

  /** The clash point on screen, in CSS px. */
  clash() {
    const { boxW, boxH, left, top } = this.box()
    return { x: left + this.offset + boxW * CLASH.x, y: top + boxH * CLASH.y }
  }

  /** Must match the CSS size of the fighters element in /battle. */
  private box() {
    // Covers the screen, but in portrait (phones) stays wide enough to show
    // both fighters instead of just the gloves.
    const boxW = Math.max(this.W, Math.min(this.H * ASPECT, this.W * 1.3))
    const boxH = boxW / ASPECT
    return { boxW, boxH, left: (this.W - boxW) / 2, top: (this.H - boxH) / 2 }
  }

  private targetFor(share: number) {
    return (share - 0.5) * 2 * REACH * this.box().boxW
  }

  private resize = () => {
    this.W = innerWidth
    this.H = innerHeight
    this.dpr = Math.min(devicePixelRatio || 1, 1.5)
    this.canvas.width = Math.round(this.W * this.dpr)
    this.canvas.height = Math.round(this.H * this.dpr)
    this.target = this.targetFor(this.share)
    const count = Math.round((this.W * this.H) / 26000)
    this.embers = Array.from({ length: count }, () => this.ember(true))
  }

  private ember(anywhere: boolean): Ember {
    return {
      x: Math.random() * this.W,
      y: anywhere ? Math.random() * this.H : this.H + 10,
      vy: 12 + Math.random() * 38,
      drift: Math.random() * 30 - 15,
      size: 0.6 + Math.random() * 1.8,
      phase: Math.random() * 6.28,
      warm: Math.random() < 0.5,
    }
  }

  /** A jagged vertical bolt through the clash point. */
  private makeBolt(cx: number, cy: number) {
    const pts: [number, number][] = []
    const top = -20
    const bottom = cy + this.H * 0.42
    const steps = 22
    let x = cx + (Math.random() - 0.5) * 30
    for (let i = 0; i <= steps; i++) {
      const y = top + ((bottom - top) * i) / steps
      // Pinched at the clash point, wilder further away.
      const spread = 8 + Math.abs(y - cy) * 0.08
      x += (Math.random() - 0.5) * spread
      x += (cx - x) * 0.25
      pts.push([x, y])
    }
    return pts
  }

  private frame(now: number) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000)
    this.last = now
    const t = now / 1000

    // Spring (slightly underdamped, so it overshoots).
    const k = 90
    const c = 11
    this.velocity += (-(this.offset - this.target) * k - this.velocity * c) * dt
    this.offset += this.velocity * dt

    // Screen shake decays quickly.
    this.shake = Math.max(0, this.shake - dt * 2.4)
    const s = this.shake ** 2 * Math.min(this.W, this.H) * 0.018
    const sx = (Math.random() - 0.5) * s
    const sy = (Math.random() - 0.5) * s
    this.stage.style.transform = s > 0.1 ? `translate3d(${sx}px,${sy}px,0)` : ""
    // Gentle bob so the fighters never look frozen.
    const bob = this.animate ? Math.sin(t * 2.1) * 4 : 0
    this.fighters.style.transform = `translate3d(calc(-50% + ${this.offset}px), calc(-50% + ${bob}px), 0)`

    if (!this.animate && this.sparks.length === 0) return
    this.draw(t, dt)
  }

  private draw(t: number, dt: number) {
    const { ctx, W, H, dpr } = this
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const { x: cx, y: cy } = this.clash()

    // Embers drifting up.
    ctx.globalCompositeOperation = "lighter"
    for (const e of this.embers) {
      e.y -= e.vy * dt
      e.x += Math.sin(t + e.phase) * e.drift * dt
      if (e.y < -10) Object.assign(e, this.ember(false))
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 2 + e.phase) ** 2
      ctx.fillStyle = e.warm ? "#ff8a4a" : "#6fd3ff"
      ctx.fillRect(e.x, e.y, e.size, e.size)
    }

    // Lightning at the clash point, re-drawn a few times a second.
    this.boltTimer -= dt
    if (this.boltTimer <= 0) {
      this.bolt = this.makeBolt(cx, cy)
      this.boltSeed = Math.random()
      this.boltTimer = 0.06 + Math.random() * 0.12
    }
    const flicker = 0.55 + 0.45 * Math.sin(t * 37 + this.boltSeed * 10) ** 2
    const boltAlpha = Math.min(1, 0.35 + flicker * 0.4 + this.flash)
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    for (const [width, color, alpha] of [
      [14, "rgba(150,190,255,1)", 0.12],
      [6, "rgba(200,220,255,1)", 0.35],
      [2, "rgba(255,255,255,1)", 1],
    ] as const) {
      ctx.globalAlpha = boltAlpha * alpha
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(this.bolt[0][0], this.bolt[0][1])
      for (const [x, y] of this.bolt) ctx.lineTo(x, y)
      ctx.stroke()
    }

    // Glow where the gloves meet.
    const R = Math.min(W, H) * (0.12 + this.flash * 0.2)
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
    glow.addColorStop(0, `rgba(255,255,255,${0.35 + this.flash * 0.6})`)
    glow.addColorStop(0.3, `rgba(255,200,150,${0.15 + this.flash * 0.3})`)
    glow.addColorStop(1, "rgba(255,200,150,0)")
    ctx.globalAlpha = 1
    ctx.fillStyle = glow
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

    // Shockwaves.
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]
      ring.life -= dt * 1.6
      ring.r += dt * Math.max(W, H) * 0.9
      if (ring.life <= 0) {
        this.rings.splice(i, 1)
        continue
      }
      ctx.globalAlpha = Math.min(1, ring.life) * 0.8
      ctx.strokeStyle = ring.color
      ctx.lineWidth = 3 + ring.life * 10
      ctx.beginPath()
      ctx.ellipse(ring.x, ring.y, ring.r, ring.r * 0.55, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Sparks, with gravity and streaks.
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i]
      p.vy += H * 0.9 * dt
      p.vx *= 1 - dt * 1.2
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= p.decay * dt
      if (p.life <= 0) {
        this.sparks.splice(i, 1)
        continue
      }
      ctx.globalAlpha = p.life
      ctx.strokeStyle = p.color
      ctx.lineWidth = p.size
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03)
      ctx.stroke()
    }

    // Screen flash.
    if (this.flash > 0.01) {
      ctx.globalAlpha = this.flash * 0.35
      ctx.fillStyle = this.flashColor
      ctx.fillRect(0, 0, W, H)
      this.flash = Math.max(0, this.flash - dt * 3)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
  }
}
