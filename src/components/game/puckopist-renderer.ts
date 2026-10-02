import {
  type GameEvent,
  type Obstacle,
  Run,
  rng,
  type Skier,
  type Terrain,
} from "@/lib/game/puckopist"

/*
 * Draws Puckopist (/game) on a canvas and runs its loop: the same night-time
 * Åre as the landing page (starry sky, aurora, moonlit ranges), with a
 * floodlit piste in front that scrolls past as the skier rides down it.
 *
 * - The sky is pre-rendered once per size; mountain ranges and the forest
 *   behind the piste are computed per frame from noise, so they scroll
 *   endlessly with parallax.
 * - The piste and everything on it is drawn in world units, with the
 *   camera as the canvas transform.
 */

export type Hud = {
  score: number
  cans: number
  distance: number
  /** The combo multiplier, 0 without one. */
  combo: number
}

/** A finished run, for the server to check. */
export type RunRecord = Hud & {
  ticks: number
  inputs: number[]
  digest: number
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  decay: number
  size: number
  color: string
  /** Falls with gravity (snow) or floats (sparkles). */
  heavy: boolean
}

type Ctx = CanvasRenderingContext2D

const SKY_TOP = "#03071c"
const SKY_MID = "#0b1335"
const SKY_HOR = "#1a244f"
/** The site's pink, for the skier's jacket. */
const JACKET = "#e83d84"
const PUCKO_ORANGE = "#ff9a1f"
/**
 * Obstacles glow in this red, which nothing else in the scene uses, so they
 * stand out against both the dark sky and the lit snow.
 */
const DANGER = "#ff3347"
/**
 * How much taller obstacles are drawn than they hit (and a little longer):
 * forgiving, and easier to see.
 */
const OBSTACLE_SCALE = 1.2
const OBSTACLE_EXTRA = 8

function canvas(w: number, h: number) {
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

function context(c: HTMLCanvasElement) {
  const g = c.getContext("2d")
  if (!g) throw new Error("Canvas 2D is not supported")
  return g
}

/** Soft round sprite fading from `color` to transparent. */
function glowSprite(color: string, size = 64) {
  const c = canvas(size, size)
  const g = context(c)
  const h = size / 2
  const gr = g.createRadialGradient(h, h, 0, h, h, h)
  gr.addColorStop(0, color)
  gr.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = gr
  g.fillRect(0, 0, size, size)
  return c
}

/** 1D value noise. */
function noise(seed: number) {
  const r = rng(seed)
  const p = Array.from({ length: 1024 }, r)
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return p[i & 1023] * (1 - u) + p[(i + 1) & 1023] * u
  }
}

/** Ridged fractal noise, for sharp mountain crests. */
function ridged(n: (x: number) => number, x: number, octaves: number) {
  let v = 0
  let a = 0.5
  let f = 1
  let t = 0
  for (let i = 0; i < octaves; i++) {
    v += a * (1 - Math.abs(n(x * f + i * 17.3) * 2 - 1))
    t += a
    a *= 0.5
    f *= 2.07
  }
  return v / t
}

/** A stable pseudo-random number in [0, 1) for an integer. */
function hash(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** A snowy spruce, `h` tall with its base at (x, y). */
function spruce(g: Ctx, x: number, y: number, h: number, c: string) {
  g.fillStyle = "#140f0c"
  g.fillRect(x - h * 0.03, y - h * 0.14, h * 0.06, h * 0.14)
  for (let i = 0; i < 3; i++) {
    const by = y - h * 0.1 - i * h * 0.28
    const tw = h * 0.36 * (1 - i * 0.24)
    const th = h * (0.42 - i * 0.04)
    g.fillStyle = c
    g.beginPath()
    g.moveTo(x, by - th)
    g.lineTo(x - tw, by)
    g.lineTo(x + tw, by)
    g.fill()
    g.fillStyle = "rgba(150,175,230,.5)"
    g.beginPath()
    g.moveTo(x, by - th)
    g.lineTo(x - tw * 0.92, by - th * 0.04)
    g.lineTo(x - tw * 0.3, by - th * 0.22)
    g.lineTo(x + tw * 0.35, by - th * 0.12)
    g.lineTo(x + tw * 0.1, by - th * 0.55)
    g.fill()
  }
}

function treeSprite(color: string) {
  const c = canvas(96, 96)
  spruce(context(c), 48, 96, 96, color)
  return c
}

/** Size of the Pucko bottle as drawn on the piste, in world units. */
const BOTTLE_W = 22
const BOTTLE_H = 44

/**
 * A Pucko bottle, like the real one: a short, stout glass bottle full of
 * chocolate milk, a gold screw cap, and the logo (brown PUCKO letters edged
 * in white on an orange disc with a brown rim). Drawn at 4× for sharpness.
 */
function bottleSprite() {
  const k = 4
  const W = BOTTLE_W * k
  const H = BOTTLE_H * k
  const c = canvas(W, H)
  const g = context(c)
  g.scale(k, k)
  const mid = BOTTLE_W / 2
  const body = BOTTLE_W - 2
  // The glass, from the neck out over round shoulders to a heavy base.
  const glass = () => {
    g.beginPath()
    g.moveTo(mid - 4.5, 6.5)
    g.lineTo(mid - 4.5, 9)
    g.bezierCurveTo(mid - 4.5, 13, 1, 13, 1, 18)
    g.lineTo(1, BOTTLE_H - 3)
    g.quadraticCurveTo(1, BOTTLE_H - 0.5, 4, BOTTLE_H - 0.5)
    g.lineTo(BOTTLE_W - 4, BOTTLE_H - 0.5)
    g.quadraticCurveTo(BOTTLE_W - 1, BOTTLE_H - 0.5, BOTTLE_W - 1, BOTTLE_H - 3)
    g.lineTo(BOTTLE_W - 1, 18)
    g.bezierCurveTo(BOTTLE_W - 1, 13, mid + 4.5, 13, mid + 4.5, 9)
    g.lineTo(mid + 4.5, 6.5)
    g.closePath()
  }
  // Chocolate milk seen through the glass, darker at the edges.
  const choc = g.createLinearGradient(1, 0, BOTTLE_W - 1, 0)
  choc.addColorStop(0, "#2b1307")
  choc.addColorStop(0.3, "#7a3f1a")
  choc.addColorStop(0.55, "#8c4c22")
  choc.addColorStop(1, "#2b1307")
  glass()
  g.fillStyle = choc
  g.fill()
  g.lineWidth = 0.8
  g.strokeStyle = "rgba(255,240,220,.55)"
  g.stroke()
  // Shine down the glass.
  g.fillStyle = "rgba(255,255,255,.4)"
  g.beginPath()
  g.roundRect(3.2, 17, 1.6, BOTTLE_H - 22, 1)
  g.fill()
  g.fillStyle = "rgba(255,255,255,.25)"
  g.fillRect(mid - 3.2, 7, 1, 4)

  // Gold screw cap, with its ridges.
  const gold = g.createLinearGradient(mid - 5.5, 0, mid + 5.5, 0)
  gold.addColorStop(0, "#7d5a12")
  gold.addColorStop(0.35, "#f7dc85")
  gold.addColorStop(0.6, "#d4a73c")
  gold.addColorStop(1, "#6f4f0e")
  g.fillStyle = gold
  g.beginPath()
  g.roundRect(mid - 5.5, 0.5, 11, 6.5, 1.2)
  g.fill()
  g.strokeStyle = "rgba(90,60,10,.55)"
  g.lineWidth = 0.4
  for (let x = mid - 4.5; x <= mid + 4.5; x += 1.5) {
    g.beginPath()
    g.moveTo(x, 1.5)
    g.lineTo(x, 6.2)
    g.stroke()
  }

  // The logo: an orange disc with a brown rim and the name across it.
  const ly = 29
  const r = body / 2
  g.fillStyle = "#4a2410"
  g.beginPath()
  g.arc(mid, ly, r, 0, Math.PI * 2)
  g.fill()
  const disc = g.createRadialGradient(mid - 2, ly - 3, 1, mid, ly, r)
  disc.addColorStop(0, "#ffb347")
  disc.addColorStop(1, "#f47b00")
  g.fillStyle = disc
  g.beginPath()
  g.arc(mid, ly, r - 1.2, 0, Math.PI * 2)
  g.fill()
  g.font = `900 4.1px "Archivo Black", "Arial Black", sans-serif`
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.lineJoin = "round"
  g.lineWidth = 1
  g.strokeStyle = "#ffffff"
  g.strokeText("PUCKO", mid, ly - 0.4)
  g.fillStyle = "#4a2410"
  g.fillText("PUCKO", mid, ly - 0.4)
  g.font = `700 2px "Instrument Sans", Arial, sans-serif`
  g.fillStyle = "#ffffff"
  g.fillText("CHOKLAD", mid, ly + 4)
  return c
}

/** Sky with stars, aurora and a crescent moon, for one viewport size. */
function skyCanvas(W: number, H: number) {
  const c = canvas(W, H)
  const g = context(c)
  const sg = g.createLinearGradient(0, 0, 0, H * 0.7)
  sg.addColorStop(0, SKY_TOP)
  sg.addColorStop(0.55, SKY_MID)
  sg.addColorStop(1, SKY_HOR)
  g.fillStyle = sg
  g.fillRect(0, 0, W, H)

  const r = rng(5)
  for (let i = 0; i < (W * H) / 3500; i++) {
    const z = r() < 0.08 ? 2 : r() < 0.3 ? 1.5 : 1
    g.fillStyle = `rgba(235,238,255,${0.3 + r() * 0.6})`
    g.fillRect(r() * W, r() * H * 0.6, z, z)
  }

  // Aurora: vertical strips along a wavy band, drawn at half resolution
  // and scaled up so the strips blend together.
  const n = noise(99)
  const aw = Math.ceil(W / 2)
  const aurora = canvas(aw, H / 2)
  const ag = context(aurora)
  for (let x = 0; x < aw; x += 2) {
    const k = n(x * 0.008) ** 2
    const top = (H / 2) * (0.06 + 0.12 * n(x * 0.0042 + 40))
    const len = (H / 2) * (0.12 + 0.16 * n(x * 0.012 + 9))
    const gr = ag.createLinearGradient(0, top, 0, top + len)
    gr.addColorStop(0, "rgba(160,90,255,0)")
    gr.addColorStop(0.5, `rgba(80,255,180,${0.08 + 0.25 * k})`)
    gr.addColorStop(0.9, `rgba(160,255,215,${0.12 + 0.35 * k})`)
    gr.addColorStop(1, "rgba(60,255,170,0)")
    ag.fillStyle = gr
    ag.fillRect(x, top, 2, len)
  }
  g.globalCompositeOperation = "lighter"
  g.drawImage(aurora, 0, 0, W, H)
  g.globalCompositeOperation = "source-over"

  const s = Math.max(0.7, H / 900)
  // Below the scoreboard on phones.
  const mX = W * 0.8
  const mY = H * (W < H ? 0.25 : 0.16)
  const R = Math.max(W, H) * 0.14
  const glow = g.createRadialGradient(mX, mY, 0, mX, mY, R)
  glow.addColorStop(0, "rgba(200,215,255,.22)")
  glow.addColorStop(1, "rgba(200,215,255,0)")
  g.fillStyle = glow
  g.fillRect(mX - R, mY - R, R * 2, R * 2)
  g.fillStyle = "#f1f3ff"
  g.beginPath()
  g.arc(mX, mY, 12 * s, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = SKY_TOP
  g.globalAlpha = 0.92
  g.beginPath()
  g.arc(mX + 5.5 * s, mY - 3 * s, 11 * s, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1
  return c
}

type Range = {
  noise: (x: number) => number
  parallax: number
  /** Base line and height, as fractions of the screen height. */
  base: number
  amp: number
  /** Screen px per noise unit. */
  width: number
  top: string
  bot: string
}

export class PuckopistRenderer {
  private readonly ctx: Ctx
  private raf = 0
  private last = 0
  private t = 0
  private W = 0
  private H = 0
  private dpr = 1
  /** Screen px per world unit. */
  private s = 1
  /**
   * Extra size for things that must stay easy to see (signs, red edges,
   * bottles) when the piste is zoomed out on a small screen.
   */
  private boost = 1

  private run: Run
  private playing = false
  private held = false
  private pressed = false
  private camX = 0
  private camY = 0
  private shake = 0
  private particles: Particle[] = []
  private hud = ""

  private sky: HTMLCanvasElement | null = null
  private readonly bottle = bottleSprite()
  private readonly trees = [treeSprite("#0b1430"), treeSprite("#09112a")]
  private readonly frontTree = treeSprite("#050a1a")
  private readonly warm = glowSprite("rgba(255,236,200,1)")
  private readonly orange = glowSprite("rgba(255,170,60,1)", 32)
  private readonly danger = glowSprite("rgba(255,51,71,1)", 64)
  private readonly ranges: Range[] = [
    {
      noise: noise(11),
      parallax: 0.03,
      base: 0.5,
      amp: 0.2,
      width: 520,
      top: "#26345d",
      bot: "#1a2446",
    },
    {
      noise: noise(17),
      parallax: 0.08,
      base: 0.58,
      amp: 0.17,
      width: 360,
      top: "#2b3a66",
      bot: "#18223f",
    },
  ]
  private readonly hills = noise(23)

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: {
      onEvent: (e: GameEvent, at: { x: number; y: number }) => void
      onHud: (hud: Hud) => void
      /** Screen shake; off for people who prefer reduced motion. */
      shake: boolean
    }
  ) {
    this.ctx = context(canvas)
    this.run = new Run(1)
  }

  start() {
    this.resize()
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

  /** Starts a new run on the piste of `seed`. */
  play(seed: number) {
    this.run = new Run(seed)
    this.playing = true
    this.particles = []
    this.held = false
    this.pressed = false
    this.snapCamera()
  }

  /** The current run's score, cans and distance. */
  stats(): Hud {
    const { score, cans, distance, combo } = this.run
    return { score, cans, distance, combo }
  }

  /** The run so far, with what the server needs to replay it. */
  result(): RunRecord {
    const { ticks, inputs, digest } = this.run
    return { ...this.stats(), ticks, inputs: [...inputs], digest }
  }

  press() {
    if (!this.held) this.pressed = true
    this.held = true
  }

  release() {
    this.held = false
  }

  private resize = () => {
    this.W = innerWidth
    this.H = innerHeight
    this.dpr = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(this.W * this.dpr)
    this.canvas.height = Math.round(this.H * this.dpr)
    // At least ~1 s of piste ahead of the skier on every screen, so phones
    // get as much warning as a laptop.
    const ahead = this.W * (1 - this.anchor().x)
    this.s = Math.min(1.5, Math.max(0.45, Math.min(this.H / 900, ahead / 950)))
    this.boost = Math.min(1.5, Math.max(1, 0.7 / this.s))
    this.sky = skyCanvas(this.W, this.H)
    this.snapCamera()
  }

  /** Where the skier sits on screen, as fractions of its size. */
  private anchor() {
    return { x: this.W < this.H ? 0.14 : 0.3, y: 0.5 }
  }

  private snapCamera() {
    const a = this.anchor()
    this.camX = this.run.skier.x - (this.W * a.x) / this.s
    this.camY = this.run.skier.y - (this.H * a.y) / this.s
  }

  private moveCamera(dt: number) {
    const { skier } = this.run
    const a = this.anchor()
    const s = this.s
    this.camX = skier.x - (this.W * a.x) / s
    const target = skier.y - (this.H * a.y) / s
    this.camY += (target - this.camY) * Math.min(1, dt * 5)
    // Never let the skier leave the middle of the screen.
    const y = (skier.y - this.camY) * s
    if (y < this.H * 0.25) this.camY = skier.y - (this.H * 0.25) / s
    if (y > this.H * 0.75) this.camY = skier.y - (this.H * 0.75) / s
  }

  private toScreen(x: number, y: number) {
    return { x: (x - this.camX) * this.s, y: (y - this.camY) * this.s }
  }

  private frame(now: number) {
    // Never backwards, whatever timestamps the browser hands out.
    const dt = Math.max(0, Math.min(0.05, (now - (this.last || now)) / 1000))
    this.last = now
    this.t += dt

    if (this.playing) {
      const events = this.run.update(dt, this.held, this.pressed)
      this.pressed = false
      for (const e of events) this.react(e)
      const hud = this.stats()
      const key = `${hud.score}/${hud.cans}/${hud.distance}/${hud.combo}`
      if (key !== this.hud) {
        this.hud = key
        this.opts.onHud(hud)
      }
    }
    this.moveCamera(dt)
    this.spray(dt)
    this.shake = Math.max(0, this.shake - dt * 2.5)
    this.draw(dt)
  }

  private react(e: GameEvent) {
    const s = this.run.skier
    if (e.kind === "can") {
      this.burst(e.x, e.y, 16, ["#ffc15a", PUCKO_ORANGE, "#fff1c9"], false)
      this.opts.onEvent(e, this.toScreen(e.x, e.y))
      return
    }
    if (e.kind === "land") this.burst(s.x, s.y, 26, ["#ffffff"], true)
    if (e.kind === "crash") {
      this.burst(s.x, s.y - 20, 70, ["#ffffff", "#dfe9ff", JACKET], true)
      if (this.opts.shake) this.shake = 1
    }
    this.opts.onEvent(e, this.toScreen(s.x, s.y - 60))
  }

  private burst(
    x: number,
    y: number,
    n: number,
    colors: string[],
    heavy: boolean
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 80 + Math.random() * 320
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (heavy ? 200 : 60),
        life: 1,
        decay: 1 + Math.random() * 1.2,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        heavy,
      })
    }
  }

  /** Snow kicked up behind the skis. */
  private spray(dt: number) {
    const s = this.run.skier
    if (!this.playing || !s.grounded || this.run.status === "crashed") return
    const n = Math.floor(s.v * dt * 0.12 + Math.random())
    for (let i = 0; i < n; i++)
      this.particles.push({
        x: s.x - Math.cos(s.angle) * 18,
        y: s.y - 2,
        vx: -s.v * (0.1 + Math.random() * 0.25),
        vy: -60 - Math.random() * 160,
        life: 0.8,
        decay: 1.4 + Math.random(),
        size: 1.5 + Math.random() * 3.5,
        color: "#eef4ff",
        heavy: true,
      })
  }

  private draw(dt: number) {
    const { ctx, W, H, dpr } = this
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
    if (this.sky) ctx.drawImage(this.sky, 0, 0, W, H)
    for (const r of this.ranges) this.drawRange(r)
    this.drawHills()

    // The piste, in world units.
    const k = dpr * this.s
    const q = this.shake ** 2 * 14
    const sx = (Math.random() - 0.5) * q
    const sy = (Math.random() - 0.5) * q
    ctx.setTransform(
      k,
      0,
      0,
      k,
      (-this.camX * this.s + sx) * dpr,
      (-this.camY * this.s + sy) * dpr
    )
    const x0 = this.camX - 60
    const x1 = this.camX + W / this.s + 60
    const T = this.run.terrain
    this.drawLights(T, x0, x1, false)
    this.drawBackTrees(T, x0, x1)
    this.drawMarkers(T, x0, x1)
    this.drawGround(T, x0, x1)
    this.drawLights(T, x0, x1, true)
    this.drawObstacles(T, x0, x1)
    this.drawCans(T, x0, x1)
    this.drawSkier(this.run.skier, this.run.status === "crashed")
    this.drawParticles(dt)
    this.drawFrontTrees(T, x0, x1)
  }

  /** A distant mountain range, scrolling slowly. */
  private drawRange(r: Range) {
    const { ctx, W, H } = this
    const off = this.camX * this.s * r.parallax
    const y = (px: number) =>
      H * r.base - H * r.amp * ridged(r.noise, (px + off) / r.width, 5)
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (let px = 0; px <= W + 4; px += 4) ctx.lineTo(px, y(px))
    ctx.lineTo(W + 4, H)
    ctx.closePath()
    const gr = ctx.createLinearGradient(0, H * (r.base - r.amp), 0, H * r.base)
    gr.addColorStop(0, r.top)
    gr.addColorStop(1, r.bot)
    ctx.fillStyle = gr
    ctx.fill()
    ctx.lineWidth = 1.2
    ctx.strokeStyle = "rgba(147,170,223,.35)"
    ctx.beginPath()
    for (let px = 0; px <= W + 4; px += 4) ctx.lineTo(px, y(px))
    ctx.stroke()
  }

  /** Forested hills with a chairlift, between the ranges and the piste. */
  private drawHills() {
    const { ctx, W, H } = this
    const p = 0.25
    const off = this.camX * this.s * p
    const sc = Math.max(0.6, H / 900)
    const y = (px: number) => H * 0.7 - H * 0.07 * this.hills((px + off) / 300)
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (let px = 0; px <= W + 6; px += 6) ctx.lineTo(px, y(px))
    ctx.lineTo(W + 6, H)
    ctx.closePath()
    const gr = ctx.createLinearGradient(0, H * 0.62, 0, H)
    gr.addColorStop(0, "#141d42")
    gr.addColorStop(1, "#0a1029")
    ctx.fillStyle = gr
    ctx.fill()

    // Spruces along the ridge.
    const step = 14 * sc
    const first = Math.floor(off / step)
    for (let i = first; i < first + W / step + 2; i++) {
      const hv = hash(i)
      if (hv < 0.35) continue
      const px = i * step - off + hash(i + 7) * step
      const h = (16 + hash(i + 3) * 22) * sc
      ctx.drawImage(this.trees[i & 1], px - h / 2, y(px) - h + 4 * sc, h, h)
    }

    // Chairlift towers and cable.
    const gap = 420 * sc
    const firstTower = Math.floor(off / gap) - 1
    ctx.strokeStyle = "#060a1c"
    ctx.lineWidth = 2 * sc
    let prev: [number, number] | null = null
    for (let i = firstTower; i < firstTower + W / gap + 3; i++) {
      const px = i * gap - off
      const top = y(px) - 110 * sc
      ctx.beginPath()
      ctx.moveTo(px, y(px) + 4)
      ctx.lineTo(px, top)
      ctx.moveTo(px - 12 * sc, top)
      ctx.lineTo(px + 12 * sc, top)
      ctx.stroke()
      if (prev) {
        const [qx, qy] = prev
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(qx, qy)
        ctx.quadraticCurveTo((qx + px) / 2, (qy + top) / 2 + 26 * sc, px, top)
        ctx.stroke()
        // A chair halfway along.
        const cx = (qx + px) / 2
        const cy = (qy + top) / 2 + 13 * sc
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx, cy + 14 * sc)
        ctx.lineTo(cx + 8 * sc, cy + 14 * sc)
        ctx.stroke()
        ctx.lineWidth = 2 * sc
      }
      prev = [px, top]
    }
  }

  /** Floodlight masts behind the piste, or the pools of light on the snow. */
  private drawLights(T: Terrain, x0: number, x1: number, pools: boolean) {
    const ctx = this.ctx
    for (const lx of T.lights) {
      if (lx < x0 - 300 || lx > x1 + 300) continue
      const gy = T.height(lx)
      const top = gy - 260
      if (pools) {
        ctx.globalCompositeOperation = "lighter"
        ctx.globalAlpha = 0.3
        ctx.drawImage(this.warm, lx - 280, gy - 140, 560, 280)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
        continue
      }
      // Beam.
      const beam = ctx.createLinearGradient(0, top, 0, gy)
      beam.addColorStop(0, "rgba(255,236,200,.16)")
      beam.addColorStop(1, "rgba(255,236,200,0)")
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(lx - 10, top)
      ctx.lineTo(lx + 10, top)
      ctx.lineTo(lx + 200, gy)
      ctx.lineTo(lx - 200, gy)
      ctx.fill()
      ctx.strokeStyle = "#0a1022"
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(lx, gy)
      ctx.lineTo(lx, top)
      ctx.stroke()
      ctx.fillStyle = "#1a2244"
      ctx.fillRect(lx - 16, top - 6, 32, 8)
      ctx.globalCompositeOperation = "lighter"
      ctx.drawImage(this.warm, lx - 60, top - 60, 120, 120)
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = "#fff6e0"
      ctx.fillRect(lx - 13, top - 1, 26, 3)
    }
  }

  /** Spruces on the far side of the piste. */
  private drawBackTrees(T: Terrain, x0: number, x1: number) {
    const cell = 110
    for (let i = Math.floor(x0 / cell) - 1; i <= x1 / cell; i++) {
      if (hash(i) < 0.45) continue
      const x = i * cell + hash(i + 11) * 70
      const h = 70 + hash(i + 5) * 90
      this.ctx.drawImage(
        this.trees[i & 1],
        x - h / 2,
        T.height(x) - h + 6,
        h,
        h
      )
    }
  }

  /** Orange piste markers, like the flags in Pucko's game. */
  private drawMarkers(T: Terrain, x0: number, x1: number) {
    const ctx = this.ctx
    const gap = 320
    for (let i = Math.floor(x0 / gap); i <= x1 / gap; i++) {
      const x = i * gap + 150
      const y = T.height(x) - 2
      ctx.fillStyle = PUCKO_ORANGE
      ctx.fillRect(x - 1.5, y - 40, 3, 40)
      ctx.beginPath()
      ctx.moveTo(x + 1.5, y - 40)
      ctx.lineTo(x + 18, y - 34)
      ctx.lineTo(x + 1.5, y - 28)
      ctx.fill()
    }
  }

  private groundPath(T: Terrain, x0: number, x1: number) {
    const ctx = this.ctx
    const bottom = this.camY + this.H / this.s + 400
    ctx.beginPath()
    ctx.moveTo(x0, bottom)
    for (let x = x0; x <= x1 + 10; x += 10) ctx.lineTo(x, T.height(x))
    ctx.lineTo(x1 + 10, bottom)
    ctx.closePath()
  }

  private surfacePath(T: Terrain, x0: number, x1: number) {
    const ctx = this.ctx
    ctx.beginPath()
    for (let x = x0; x <= x1 + 10; x += 10) ctx.lineTo(x, T.height(x))
  }

  /** The snow: lit at the surface, darkening below. */
  private drawGround(T: Terrain, x0: number, x1: number) {
    const ctx = this.ctx
    this.groundPath(T, x0, x1)
    ctx.fillStyle = "#141e46"
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.lineJoin = "round"
    this.surfacePath(T, x0, x1)
    for (const [w, c] of [
      [320, "rgba(60,80,150,.35)"],
      [160, "rgba(93,118,184,.45)"],
      [70, "rgba(141,164,220,.6)"],
      [26, "rgba(192,208,242,.8)"],
      [8, "#e9f0ff"],
    ] as const) {
      ctx.lineWidth = w
      ctx.strokeStyle = c
      ctx.stroke()
    }
    ctx.restore()
    this.surfacePath(T, x0, x1)
    ctx.lineWidth = 2
    ctx.strokeStyle = "#ffffff"
    ctx.stroke()
  }

  /**
   * Obstacles, signposted by their `cue`: at the start a big warning sign and
   * a strong red glow; further down a smaller sign, then none, and only a
   * faint glow. The red edge always stays, so none is ever invisible.
   */
  private drawObstacles(T: Terrain, x0: number, x1: number) {
    const ctx = this.ctx
    // A slow pulse, to catch the eye without flashing.
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 5)
    let lastSign = Number.NEGATIVE_INFINITY
    for (const o of T.obstacles) {
      if (o.x + o.w / 2 < x0 - 120 || o.x - o.w / 2 > x1 + 120) continue
      const w = o.w + OBSTACLE_EXTRA
      const h = o.h * OBSTACLE_SCALE
      const front = o.x - w / 2
      const glow = 0.15 + 0.85 * o.cue
      // A red glow on the snow around it.
      ctx.globalCompositeOperation = "lighter"
      ctx.globalAlpha = glow * (0.55 + 0.3 * pulse)
      const gy = T.height(o.x)
      ctx.drawImage(this.danger, front - h, gy - h * 2, w + h * 2, h * 3)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"
      // One warning sign in front of each group (rock pairs share one), as
      // long as it's still signposted.
      if (o.cue > 0.35 && o.x - lastSign > 260)
        this.drawWarningSign(
          T,
          front - 22,
          pulse,
          (0.5 + 0.5 * o.cue) * this.boost
        )
      lastSign = o.x

      if (o.kind === "rubble") this.drawRubble(T, o, glow)
      else this.drawSolid(T, o, w, h, glow)
    }
  }

  /** Strokes the current path with the glowing red edge every obstacle has. */
  private dangerEdge(glow: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.shadowColor = DANGER
    ctx.shadowBlur = 16 * glow * this.s * this.dpr
    ctx.lineJoin = "round"
    ctx.lineWidth = (2.5 + glow) * this.boost
    ctx.strokeStyle = DANGER
    ctx.globalAlpha = 0.65 + 0.35 * glow
    ctx.stroke()
    ctx.restore()
  }

  /** Rocks, boulders and logs (lying along the slope). */
  private drawSolid(
    T: Terrain,
    o: Obstacle,
    w: number,
    h: number,
    glow: number
  ) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(o.x, T.height(o.x) + 3)
    if (o.kind === "log") ctx.rotate(Math.atan(T.slope(o.x)))
    ctx.beginPath()
    if (o.kind === "log") ctx.roundRect(-w / 2, -h, w, h, h / 2)
    else {
      ctx.moveTo(-w / 2, 0)
      ctx.lineTo(-w * 0.42, -h * 0.6)
      ctx.lineTo(-w * 0.1, -h)
      ctx.lineTo(w * 0.3, -h * 0.85)
      ctx.lineTo(w / 2, -h * 0.3)
      ctx.lineTo(w / 2, 0)
      ctx.closePath()
    }
    // A dark body with a glowing red edge.
    const gr = ctx.createLinearGradient(0, -h, 0, 0)
    if (o.kind === "log") {
      gr.addColorStop(0, "#8a4e24")
      gr.addColorStop(1, "#3a1d0b")
    } else {
      gr.addColorStop(0, "#4b5276")
      gr.addColorStop(1, "#151933")
    }
    ctx.fillStyle = gr
    ctx.fill()
    this.dangerEdge(glow)

    // Details on top: a log's bark lines and cut end, snow on a rock.
    if (o.kind === "log") {
      ctx.strokeStyle = "rgba(30,14,4,.55)"
      ctx.lineWidth = 1.5
      for (let x = -w / 2 + 14; x < w / 2 - h; x += 22) {
        ctx.beginPath()
        ctx.moveTo(x, -h * 0.35)
        ctx.lineTo(x + 10, -h * 0.35)
        ctx.stroke()
      }
      ctx.fillStyle = "#e0a56b"
      ctx.beginPath()
      ctx.ellipse(w / 2 - h / 2, -h / 2, h / 3, h / 2 - 2, 0, 0, 7)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.roundRect(-w / 2 + 5, -h - 3, w - h - 2, 6, 3)
      ctx.fill()
    } else {
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.moveTo(-w * 0.38, -h * 0.62)
      ctx.lineTo(-w * 0.1, -h - 2)
      ctx.lineTo(w * 0.28, -h * 0.86)
      ctx.lineTo(w * 0.1, -h * 0.72)
      ctx.lineTo(-w * 0.2, -h * 0.8)
      ctx.fill()
    }
    ctx.restore()
  }

  /** A long, low stretch of stones, following the snow. */
  private drawRubble(T: Terrain, o: Obstacle, glow: number) {
    const ctx = this.ctx
    const w = o.w + OBSTACLE_EXTRA
    const h = o.h * OBSTACLE_SCALE
    const x0 = o.x - w / 2
    // Stones of a stable, varied size along it.
    const stones: { x: number; r: number }[] = []
    for (let x = x0 + 8, i = 0; x < x0 + w - 6; i++) {
      const r = h * (0.55 + 0.45 * hash(Math.floor(o.x) + i))
      stones.push({ x, r })
      x += r * 1.3
    }
    ctx.beginPath()
    for (const st of stones) {
      const y = T.height(st.x) + 3
      ctx.moveTo(st.x + st.r, y)
      ctx.ellipse(st.x, y, st.r, st.r * 0.95, 0, 0, Math.PI, true)
    }
    const gr = ctx.createLinearGradient(0, T.height(o.x) - h, 0, T.height(o.x))
    gr.addColorStop(0, "#4b5276")
    gr.addColorStop(1, "#151933")
    ctx.fillStyle = gr
    ctx.fill()
    this.dangerEdge(glow)
    ctx.fillStyle = "#ffffff"
    for (const st of stones) {
      const y = T.height(st.x) + 3
      ctx.beginPath()
      ctx.ellipse(
        st.x - st.r * 0.15,
        y - st.r * 0.8,
        st.r * 0.5,
        st.r * 0.2,
        0,
        0,
        7
      )
      ctx.fill()
    }
  }

  /** A red warning triangle on a post, the piste's sign for "look out". */
  private drawWarningSign(
    T: Terrain,
    x: number,
    pulse: number,
    /** 1 is full size; smaller further down. */
    scale = 1
  ) {
    const ctx = this.ctx
    const y = T.height(x)
    const top = y - 78 * scale
    const size = 34 * scale
    ctx.fillStyle = "#e9eefc"
    ctx.fillRect(x - 2, top + size * 0.5, 4, y - top - size * 0.5)
    ctx.globalCompositeOperation = "lighter"
    ctx.globalAlpha = 0.6 + 0.4 * pulse
    ctx.drawImage(
      this.danger,
      x - size * 1.3,
      top - size * 0.9,
      size * 2.6,
      size * 2.6
    )
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
    ctx.beginPath()
    ctx.moveTo(x, top - size * 0.45)
    ctx.lineTo(x + size * 0.55, top + size * 0.5)
    ctx.lineTo(x - size * 0.55, top + size * 0.5)
    ctx.closePath()
    ctx.lineJoin = "round"
    ctx.lineWidth = 4 * scale
    ctx.strokeStyle = "#ffffff"
    ctx.stroke()
    ctx.fillStyle = DANGER
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    const bar = size * 0.12
    ctx.fillRect(x - bar / 2, top - size * 0.12, bar, size * 0.38)
    ctx.fillRect(x - bar / 2, top + size * 0.32, bar, bar)
  }

  private drawCans(T: Terrain, x0: number, x1: number) {
    const ctx = this.ctx
    for (const c of T.cans) {
      if (c.taken || c.x < x0 || c.x > x1) continue
      const bob = Math.sin(this.t * 3 + c.x * 0.05) * 4
      ctx.globalCompositeOperation = "lighter"
      ctx.globalAlpha = 0.55
      ctx.drawImage(this.orange, c.x - 34, c.y + bob - 34, 68, 68)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"
      ctx.save()
      ctx.translate(c.x, c.y + bob)
      ctx.rotate(Math.sin(this.t * 2 + c.x) * 0.15)
      ctx.scale(this.boost, this.boost)
      ctx.drawImage(
        this.bottle,
        -BOTTLE_W / 2,
        -BOTTLE_H / 2,
        BOTTLE_W,
        BOTTLE_H
      )
      ctx.restore()
    }
  }

  private drawSkier(s: Skier, crashed: boolean) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(s.angle)
    // A little bigger when zoomed out on a phone, so the rider stays clear.
    const k = Math.min(1.3, this.boost)
    ctx.scale(k, k)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    if (crashed) {
      // Face down in the snow, skis every which way.
      ctx.strokeStyle = "#ffd23f"
      ctx.lineWidth = 3.2
      ctx.beginPath()
      ctx.moveTo(-30, -8)
      ctx.lineTo(10, -2)
      ctx.moveTo(-6, -14)
      ctx.lineTo(26, 0)
      ctx.stroke()
      ctx.strokeStyle = "#13213a"
      ctx.lineWidth = 7
      ctx.beginPath()
      ctx.moveTo(-26, -4)
      ctx.lineTo(-10, -5)
      ctx.stroke()
      ctx.strokeStyle = JACKET
      ctx.lineWidth = 11
      ctx.beginPath()
      ctx.moveTo(-10, -5)
      ctx.lineTo(8, -6)
      ctx.stroke()
      ctx.fillStyle = PUCKO_ORANGE
      ctx.beginPath()
      ctx.arc(17, -6, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }

    const tuck = s.grounded ? 0 : 1
    // Skis with curled tips.
    ctx.strokeStyle = "#ffd23f"
    ctx.lineWidth = 3.2
    ctx.beginPath()
    ctx.moveTo(-26, -1.5)
    ctx.lineTo(22, -1.5)
    ctx.quadraticCurveTo(29, -1.5, 30, -7)
    ctx.stroke()
    // Pole, behind the body.
    ctx.strokeStyle = "#c9d3e6"
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(16, -28 + tuck * 4)
    ctx.lineTo(-18, -3)
    ctx.stroke()
    // Legs.
    ctx.strokeStyle = "#13213a"
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(-2, -4)
    ctx.lineTo(5 + tuck * 3, -15 + tuck * 2)
    ctx.lineTo(-5, -25 + tuck * 3)
    ctx.stroke()
    // Body and arm.
    ctx.strokeStyle = JACKET
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.moveTo(-5, -25 + tuck * 3)
    ctx.lineTo(3, -40 + tuck * 4)
    ctx.stroke()
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(2, -37 + tuck * 4)
    ctx.lineTo(10, -30 + tuck * 4)
    ctx.lineTo(16, -28 + tuck * 4)
    ctx.stroke()
    ctx.fillStyle = "#13213a"
    ctx.beginPath()
    ctx.arc(16, -28 + tuck * 4, 2.8, 0, Math.PI * 2)
    ctx.fill()
    // Helmet and goggles.
    ctx.fillStyle = PUCKO_ORANGE
    ctx.beginPath()
    ctx.arc(8, -47 + tuck * 4, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#3dd6ff"
    ctx.beginPath()
    ctx.roundRect(9, -49 + tuck * 4, 7, 4, 2)
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,.8)"
    ctx.fillRect(11, -48.5 + tuck * 4, 2, 1.2)
    ctx.restore()
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.vy += (p.heavy ? 900 : 60) * dt
      p.vx *= 1 - dt * 1.5
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= p.decay * dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      ctx.globalAlpha = Math.min(1, p.life)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1
  }

  /** Big dark spruces in the snow in front of the piste. */
  private drawFrontTrees(T: Terrain, x0: number, x1: number) {
    const cell = 380
    for (let i = Math.floor(x0 / cell) - 1; i <= x1 / cell + 1; i++) {
      if (hash(i + 101) < 0.5) continue
      const x = i * cell + hash(i + 13) * 200
      const h = 150 + hash(i + 17) * 80
      const base = T.height(x) + h + 30
      this.ctx.drawImage(this.frontTree, x - h / 2, base - h, h, h)
    }
  }
}
