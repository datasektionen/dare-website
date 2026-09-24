/*
 * Canvas renderer for the night-time Åre landscape behind the landing page:
 * starry sky with the Milky Way, aurora and moon, layered mountains with
 * forests and floodlit pistes, skiers, lifts, the village, cars, a train and
 * the frozen lake with reflections. Ported from the "Scene" component in the
 * Claude Design project "Dåre 27 Landing Design", fixed at night.
 *
 * Performance notes:
 * - Everything static is pre-rendered into a handful of viewport-sized
 *   canvases (`bg`, `mountains`, `front`, `vil`, lake layers), so a frame is
 *   a few blits plus the moving parts.
 * - The pre-rendering is a generator that runs a slice per animation frame,
 *   so it never blocks the page for long. `onReady` fires once it's done.
 * - Glows use pre-rendered sprites instead of per-frame gradients, and the
 *   aurora is drawn at half resolution every other frame.
 */

type RGB = [number, number, number]
type Ctx = CanvasRenderingContext2D
type Ridge = (x: number) => number
type Rand = () => number

type Piste = {
  x0: number
  y0: number
  x1: number
  y1: number
  w: number
  at: (t: number) => [number, number]
}

type Skier = {
  p: number
  u: number
  dur: number
  turns: number
  ph: number
  trail: [number, number][]
  c: string
  max: number
}

type StarGroup = {
  b: number
  f: number
  p: number
  stars: { x: number; y: number; r: number }[]
}

type SceneState = {
  W: number
  H: number
  s: number
  roadY: number
  railY: number
  lakeTop: number
  bg: HTMLCanvasElement
  mountains: HTMLCanvasElement
  front: HTMLCanvasElement
  vil: HTMLCanvasElement
  lakeBase: HTMLCanvasElement
  lakeOverlay: HTMLCanvasElement
  aurora: HTMLCanvasElement
  auroraNoise: (x: number) => number
  pistes: Piste[]
  skP: Piste[]
  gon: { x0: number; y0: number; x1: number; y1: number }
  chair: { x0: number; y0: number; x1: number; y1: number }
  mast: [number, number]
  /** Stars batched by twinkle group, so each group is one fill. */
  starGroups: StarGroup[]
  fogs: { x: number; y: number; r: number; v: number; a: number }[]
  clouds: {
    x: number
    y: number
    sc: number
    v: number
    k: number
    a: number
  }[]
  skiersN: Skier[]
  skiersS: Skier[]
  cars: { o: number; v: number; dir: number }[]
  lights: [number, number][]
  chim: [number, number][]
}

const h2r = (h: string): RGB => {
  const n = Number.parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const rgba = (c: string | RGB, a: number) => {
  const r = typeof c === "string" ? h2r(c) : c
  return `rgba(${r[0] | 0},${r[1] | 0},${r[2] | 0},${a})`
}
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
const mix = (a: RGB, b: RGB, k: number): RGB => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
]
const cl = (v: number) => Math.max(0, Math.min(1, v))

/** Seeded PRNG (mulberry32), so the landscape looks the same every load. */
function rng(seed: number): Rand {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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

/** Fractal noise; `ridged` gives sharp mountain crests. */
function fbm(n: (x: number) => number, x: number, o: number, ridged?: boolean) {
  let v = 0
  let a = 0.5
  let f = 1
  let t = 0
  for (let i = 0; i < o; i++) {
    let s = n(x * f + i * 17.3)
    if (ridged) s = 1 - Math.abs(s * 2 - 1)
    v += a * s
    t += a
    a *= 0.5
    f *= 2.07
  }
  return v / t
}

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

/** Soft round sprite fading from `rgb` to transparent. */
function glowSprite(rgb: RGB, size = 64) {
  const c = canvas(size, size)
  const g = context(c)
  const h = size / 2
  const gr = g.createRadialGradient(h, h, 0, h, h, h)
  gr.addColorStop(0, rgba(rgb, 1))
  gr.addColorStop(1, rgba(rgb, 0))
  g.fillStyle = gr
  g.fillRect(0, 0, size, size)
  return c
}

// Night sky at 23:02 (between the 20:38 and 24:00 keyframes of the design).
const SKY_K = (0.96 - 0.86) / 0.14
const SKY_TOP = mix(h2r("#060b25"), h2r("#03061a"), SKY_K)
const SKY_MID = mix(h2r("#0f1840"), h2r("#0a1233"), SKY_K)
const SKY_HOR = mix(h2r("#222d5c"), h2r("#18224d"), SKY_K)
/** Moon altitude and horizontal position at that time. */
const MOON_ALT = -Math.sin((0.96 - 0.25) * Math.PI * 2)
const MOON_X = 0.5 + 0.45 * Math.sin(0.96 * Math.PI * 2)

/** Jacket colours for skiers. */
const JACKETS = [
  "#e83d84",
  "#ffd23f",
  "#3dd6ff",
  "#ff6b3d",
  "#8cff6b",
  "#ffffff",
  "#b77dff",
]

type Sprites = {
  puff: HTMLCanvasElement
  auroraStrip: HTMLCanvasElement
  warm: HTMLCanvasElement
  headlight: HTMLCanvasElement
  red: HTMLCanvasElement
  fog: HTMLCanvasElement
  clouds: HTMLCanvasElement[]
}

let sprites: Sprites | undefined

/** Small reusable images, created once and shared by all renderers. */
function getSprites(): Sprites {
  if (sprites) return sprites

  const auroraStrip = canvas(4, 256)
  const ag = context(auroraStrip)
  const gr = ag.createLinearGradient(0, 0, 0, 256)
  gr.addColorStop(0, "rgba(190,80,255,0)")
  gr.addColorStop(0.35, "rgba(160,90,255,.18)")
  gr.addColorStop(0.72, "rgba(60,255,170,.5)")
  gr.addColorStop(0.93, "rgba(160,255,215,.85)")
  gr.addColorStop(1, "rgba(60,255,170,0)")
  ag.fillStyle = gr
  ag.fillRect(0, 0, 4, 256)

  const clouds = [0, 1, 2].map((i) => {
    const r = rng(i * 7 + 1)
    const cv = canvas(420, 150)
    const g = context(cv)
    for (let j = 0; j < 28; j++) {
      const x = 60 + r() * 300
      const f = 1 - Math.abs(x - 210) / 230
      const y = 78 - r() * 46 * f
      const R = 18 + r() * 44 * f
      const cg = g.createRadialGradient(x, y, 0, x, y, R)
      cg.addColorStop(0, "rgba(52,65,110,.55)")
      cg.addColorStop(1, "rgba(52,65,110,0)")
      g.fillStyle = cg
      g.fillRect(x - R, y - R, R * 2, R * 2)
    }
    g.globalCompositeOperation = "destination-out"
    const bg = g.createLinearGradient(0, 84, 0, 130)
    bg.addColorStop(0, "rgba(0,0,0,0)")
    bg.addColorStop(1, "rgba(0,0,0,1)")
    g.fillStyle = bg
    g.fillRect(0, 84, 420, 66)
    return cv
  })

  sprites = {
    puff: glowSprite([235, 240, 250], 32),
    auroraStrip,
    warm: glowSprite([255, 240, 200]),
    headlight: glowSprite([255, 245, 220]),
    red: glowSprite([255, 60, 60], 32),
    fog: glowSprite(mix(SKY_HOR, [255, 255, 255], 0.35)),
    clouds,
  }
  return sprites
}

const TREE_COLORS = ["#0a1222", "#0c1526", "#08101e"]

/** Draws a snowy spruce of height `h` with its base at (x, y). */
function tree(g: Ctx, x: number, y: number, h: number, c: string) {
  const sn = "rgba(125,150,210,.42)"
  if (h < 5) {
    g.fillStyle = c
    g.beginPath()
    g.moveTo(x, y - h)
    g.lineTo(x - h * 0.34, y)
    g.lineTo(x + h * 0.34, y)
    g.fill()
    g.fillStyle = sn
    g.beginPath()
    g.moveTo(x, y - h)
    g.lineTo(x - h * 0.25, y - h * 0.25)
    g.lineTo(x, y - h * 0.45)
    g.fill()
    return
  }
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
    g.fillStyle = sn
    g.beginPath()
    g.moveTo(x, by - th)
    g.lineTo(x - tw * 0.92, by - th * 0.04)
    g.lineTo(x - tw * 0.3, by - th * 0.22)
    g.lineTo(x + tw * 0.35, by - th * 0.12)
    g.lineTo(x + tw * 0.1, by - th * 0.55)
    g.fill()
  }
}

const TREE_SPRITE = 48
let treeSprites: HTMLCanvasElement[] | undefined

/**
 * Pre-rendered spruces, one per colour, drawn scaled. Thousands of trees are
 * placed per layer, and a blit is far cheaper than seven path fills.
 */
function getTreeSprites() {
  treeSprites ??= TREE_COLORS.map((c) => {
    const cv = canvas(TREE_SPRITE, TREE_SPRITE)
    tree(context(cv), TREE_SPRITE / 2, TREE_SPRITE, TREE_SPRITE, c)
    return cv
  })
  return treeSprites
}

function strokePiste(g: Ctx, p: Piste, col: string) {
  g.lineCap = "round"
  g.strokeStyle = col
  for (let t = 0; t < 1; t += 0.01) {
    const [x, y] = p.at(t)
    const [x2, y2] = p.at(t + 0.012)
    g.lineWidth = p.w * (0.6 + 0.8 * t)
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x2, y2)
    g.stroke()
  }
}

function inPiste(list: Piste[], x: number, y: number, s: number) {
  for (const p of list) {
    const t = (y - p.y0) / (p.y1 - p.y0)
    if (t < -0.02 || t > 1.02) continue
    const tt = cl(t)
    const [px] = p.at(tt)
    if (Math.abs(x - px) < p.w * (0.6 + 0.8 * tt) * 0.5 + 3 * s) return true
  }
  return false
}

type Cable = { x0: number; y0: number; x1: number; y1: number }

/** Point on the gondola cable, u in [0, 1]. */
function gpt(G: Cable, H: number, u: number, off: number): [number, number] {
  return [
    G.x0 + (G.x1 - G.x0) * u,
    G.y0 + (G.y1 - G.y0) * u + Math.sin(Math.PI * u) * H * 0.02 + off,
  ]
}

/** Point on the chairlift cable, u in [0, 1]. */
function cpt(C: Cable, H: number, u: number, off: number): [number, number] {
  return [
    C.x0 + (C.x1 - C.x0) * u + off,
    C.y0 + (C.y1 - C.y0) * u + Math.sin(Math.PI * u) * H * 0.006,
  ]
}

type LayerConfig = {
  top: string
  bot: string
  yTop: number
  yBottom: number
  depth: number
  k: number
  la: number
  sa: number
  tex?: number
  seed: number
  /** Opacity of the horizon-coloured haze over the layer. */
  haze: number
}

const LIT = "#93aadf"
const SHADE = "#060b20"

/** Renders one snowy landscape layer onto `out`. */
function drawLayer(
  out: Ctx,
  W: number,
  H: number,
  s: number,
  ridge: Ridge,
  c: LayerConfig,
  extra?: (g: Ctx, r: Rand) => void
) {
  const cv = canvas(W, H)
  const g = context(cv)
  g.beginPath()
  g.moveTo(-3, H)
  for (let x = -3; x <= W + 3; x += 3) g.lineTo(x, ridge(x))
  g.lineTo(W + 3, H)
  g.closePath()
  const gr = g.createLinearGradient(0, c.yTop * H, 0, c.yBottom * H)
  gr.addColorStop(0, c.top)
  gr.addColorStop(1, c.bot)
  g.fillStyle = gr
  g.fill()
  g.save()
  g.clip()
  // Light and shade below the ridge, based on its slope.
  const depth = c.depth * H
  if (depth > 0)
    for (let x = -3; x <= W + 3; x += 3) {
      const y = ridge(x)
      const sl = (ridge(x + 14) - ridge(x - 14)) / 28
      const L = Math.max(-1, Math.min(1, -sl * c.k))
      const a = Math.abs(L) * (L > 0 ? c.la : c.sa)
      if (a < 0.01) continue
      const col = L > 0 ? LIT : SHADE
      const lg = g.createLinearGradient(0, y, 0, y + depth)
      lg.addColorStop(0, rgba(col, a))
      lg.addColorStop(1, rgba(col, 0))
      g.fillStyle = lg
      g.fillRect(x, y, 3.4, depth)
    }
  if (c.tex) {
    const r2 = rng(c.seed + 100)
    g.lineWidth = 0.6 * s
    for (let i = 0; i < c.tex; i++) {
      const x = r2() * W
      const y = ridge(x) + r2() ** 1.5 * depth * 1.6
      const sl = (ridge(x + 8) - ridge(x - 8)) / 16
      const len = (6 + r2() * 22) * s
      g.strokeStyle = rgba(r2() < 0.5 ? LIT : SHADE, 0.08)
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + len, y + sl * len * 0.6)
      g.stroke()
    }
  }
  g.lineWidth = 1.2 * s
  g.strokeStyle = rgba(LIT, 0.35)
  g.beginPath()
  g.moveTo(-3, ridge(-3))
  for (let x = -3; x <= W + 3; x += 3) g.lineTo(x, ridge(x))
  g.stroke()
  extra?.(g, rng(c.seed))
  g.restore()
  // Atmospheric haze: tint towards the horizon colour.
  g.globalCompositeOperation = "source-atop"
  g.globalAlpha = c.haze
  g.fillStyle = css(SKY_HOR)
  g.fillRect(0, 0, W, H)
  out.drawImage(cv, 0, 0)
}

/**
 * Builds the scene for a viewport. Yields between expensive steps so the
 * caller can spread the work over several frames.
 */
function* buildScene(W: number, H: number): Generator<void, SceneState> {
  const s = Math.min(1.6, Math.max(0.6, H / 900))
  const nF = noise(11)
  const nF2 = noise(17)
  const nS = noise(23)
  const nM = noise(37)
  const nN = noise(51)
  const far2: Ridge = (x) =>
    H * 0.56 - H * 0.13 * fbm(nF2, (x / W) * 1.8 + 11, 6, true)
  const far: Ridge = (x) =>
    H * 0.6 - H * 0.17 * fbm(nF, (x / W) * 2.6 + 4, 6, true)
  // Åreskutan: a big peak with a shoulder to the right.
  const sk: Ridge = (x) => {
    const b = Math.exp(-(((x - W * 0.6) / (W * 0.19)) ** 2))
    const sh = Math.exp(-(((x - W * 0.84) / (W * 0.1)) ** 2))
    return (
      H * 0.72 -
      H * 0.07 * fbm(nS, (x / W) * 5, 5, true) -
      H * 0.36 * b ** 0.75 -
      H * 0.1 * sh
    )
  }
  const mid: Ridge = (x) => H * 0.8 - H * 0.11 * fbm(nM, (x / W) * 3.2 + 9, 5)
  const near: Ridge = (x) =>
    H * 0.845 -
    H * 0.29 * Math.max(0, 1 - (x + W * 0.1) / (W * 0.74)) ** 1.35 -
    H * 0.02 * fbm(nN, (x / W) * 9, 4)
  const shoreY = H * 0.848
  const roadY = shoreY + H * 0.021
  const railY = shoreY + H * 0.029
  const lakeTop = shoreY + H * 0.036

  const pistes: Piste[] = (
    [
      [0.02, 0.3],
      [0.15, 0.4],
      [0.27, 0.5],
    ] as const
  ).map(([a, b], i) => {
    const x0 = W * a
    const y0 = near(x0) + 3 * s
    const x1 = W * b
    const y1 = shoreY - 2
    return {
      x0,
      y0,
      x1,
      y1,
      w: (i === 1 ? 15 : 11) * s,
      at: (t) => [
        x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 2.2 + i * 2.1) * W * 0.018,
        y0 + (y1 - y0) * t,
      ],
    }
  })
  const skP: Piste[] = (
    [
      [0.54, 0.5],
      [0.63, 0.67],
      [0.76, 0.73],
    ] as const
  ).map(([a, b], i) => {
    const x0 = W * a
    const y0 = sk(x0) + 5 * s
    const x1 = W * b
    const y1 = H * 0.668
    return {
      x0,
      y0,
      x1,
      y1,
      w: 7 * s,
      at: (t) => [
        x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 1.6 + i * 1.3) * W * 0.01,
        y0 + (y1 - y0) * t,
      ],
    }
  })
  const gon = {
    x0: W * 0.47,
    y0: shoreY - 5 * s,
    x1: W * 0.085,
    y1: near(W * 0.085) + 2 * s,
  }
  const chair = {
    x0: W * 0.7,
    y0: H * 0.668,
    x1: W * 0.8,
    y1: sk(W * 0.8) + 3 * s,
  }
  const inGondola = (x: number, y: number) => {
    const dx = gon.x1 - gon.x0
    const dy = gon.y1 - gon.y0
    const u = ((x - gon.x0) * dx + (y - gon.y0) * dy) / (dx * dx + dy * dy)
    if (u < 0 || u > 1) return false
    const [cx, cy] = gpt(gon, H, u, 0)
    return Math.hypot(x - cx, y - cy) < 7 * s
  }
  const forest = (
    g: Ctx,
    r: Rand,
    ridge: Ridge,
    yMax: number,
    count: number,
    hMin: number,
    hMax: number,
    skip?: (x: number, y: number) => boolean
  ) => {
    const pts: [number, number, number, number][] = []
    for (let i = 0; i < count; i++) {
      const x = -W * 0.1 + r() * W * 1.2
      const top = ridge(x)
      const y = top + r() * (yMax - top)
      const q = r()
      const v = r()
      if (q > Math.min(1, (y - top) / (22 * s))) continue
      // Off-screen trees still consume random numbers so the layout matches.
      if (x < -20 || x > W + 20 || skip?.(x, y)) continue
      pts.push([x, y, q, v])
    }
    pts.sort((a, b) => a[1] - b[1])
    const sprites = getTreeSprites()
    for (const [x, y, q, v] of pts) {
      const top = ridge(x)
      const k = (y - top) / (yMax - top + 1)
      const h = (hMin + (hMax - hMin) * k) * s * (0.7 + q * 0.6)
      const c = Math.floor(v * 3) % 3
      // Tiny trees are simpler shapes; draw those directly.
      if (h < 5) tree(g, x, y, h, TREE_COLORS[c])
      else g.drawImage(sprites[c], x - h / 2, y - h, h, h)
    }
  }
  let mx = W * 0.6
  let my = sk(mx)
  for (let x = W * 0.5; x < W * 0.72; x += 2) {
    const y = sk(x)
    if (y < my) {
      my = y
      mx = x
    }
  }

  const r = rng(5)
  const stars = Array.from({ length: 340 }, () => ({
    x: r(),
    y: r() * 0.62,
    r: r() < 0.08 ? 2 : r() < 0.3 ? 1.5 : 1,
    b: 0.35 + r() * 0.65,
    f: 0.5 + r() * 2.5,
    p: r() * 6.28,
  }))
  // 8 twinkle rhythms x 4 brightness levels.
  const starGroups: StarGroup[] = []
  for (let g = 0; g < 8; g++)
    for (let lvl = 0; lvl < 4; lvl++)
      starGroups.push({
        b: 0.35 + (lvl + 0.5) * 0.1625,
        f: stars[g].f,
        p: stars[g].p,
        stars: [],
      })
  stars.forEach((st, i) => {
    const lvl = Math.min(3, Math.floor(((st.b - 0.35) / 0.65) * 4))
    starGroups[(i % 8) * 4 + lvl].stars.push({
      x: st.x * W,
      y: st.y * H,
      r: st.r,
    })
  })
  const fogs = Array.from({ length: 7 }, () => ({
    x: r(),
    y: 0.6 + r() * 0.12,
    r: 0.18 + r() * 0.18,
    v: 0.3 + r() * 0.6,
    a: 0.5 + r() * 0.5,
  }))
  const clouds = Array.from({ length: 7 }, (_, i) => ({
    x: r(),
    y: 0.05 + r() * 0.3,
    sc: 0.6 + r() * 1.1,
    v: 4 + r() * 9,
    k: i % 3,
    a: 0.45 + r() * 0.5,
  }))
  const mkSk = (p: number, dur: number, small?: boolean): Skier => ({
    p,
    u: r(),
    dur: dur + r() * 9,
    turns: 16 + r() * 12,
    ph: r() * 6,
    trail: [],
    c: JACKETS[Math.floor(r() * JACKETS.length)],
    max: small ? 120 : 260,
  })
  const skiersN = Array.from({ length: 8 }, (_, i) => mkSk(i % 3, 15))
  const skiersS = Array.from({ length: 4 }, (_, i) => mkSk(i % 3, 26, true))
  const cars = Array.from({ length: 7 }, (_, i) => {
    const o = r()
    const v = 24 + r() * 26
    return { o, v, dir: i % 2 ? 1 : -1 }
  })
  yield

  // Sky: gradient, Milky Way and moon.
  const bg = canvas(W, H)
  {
    const g = context(bg)
    const hy = H * 0.64
    const sg = g.createLinearGradient(0, 0, 0, hy)
    sg.addColorStop(0, css(SKY_TOP))
    sg.addColorStop(0.55, css(SKY_MID))
    sg.addColorStop(1, css(SKY_HOR))
    g.fillStyle = sg
    g.fillRect(0, 0, W, H)

    const mw = canvas(W, H * 0.7)
    const mg = context(mw)
    const r2 = rng(77)
    const ax = W * 0.02
    const ay = H * 0.66
    const bx = W * 0.98
    const by = H * 0.02
    const LL = Math.hypot(bx - ax, by - ay)
    const px = -(by - ay) / LL
    const py = (bx - ax) / LL
    mg.globalCompositeOperation = "lighter"
    for (let i = 0; i < 24; i++) {
      const t = r2()
      const cx = ax + (bx - ax) * t + px * (r2() - 0.5) * H * 0.06
      const cy = ay + (by - ay) * t + py * (r2() - 0.5) * H * 0.06
      const R = W * (0.05 + r2() * 0.07)
      const gr = mg.createRadialGradient(cx, cy, 0, cx, cy, R)
      gr.addColorStop(
        0,
        r2() < 0.5 ? "rgba(160,150,255,.08)" : "rgba(255,200,230,.06)"
      )
      gr.addColorStop(1, "rgba(0,0,0,0)")
      mg.fillStyle = gr
      mg.fillRect(cx - R, cy - R, R * 2, R * 2)
    }
    for (let i = 0; i < 2600; i++) {
      const t = r2()
      const gs = (r2() + r2() + r2() - 1.5) * H * 0.08
      const x = ax + (bx - ax) * t + px * gs
      const y = ay + (by - ay) * t + py * gs
      const z = r2() < 0.9 ? 0.7 : 1.3
      mg.fillStyle = `rgba(235,238,255,${0.15 + r2() * 0.5})`
      mg.fillRect(x, y, z, z)
    }
    mg.globalCompositeOperation = "destination-out"
    for (let i = 0; i < 14; i++) {
      const t = 0.15 + r2() * 0.7
      const cx = ax + (bx - ax) * t + px * H * 0.012 * (r2() - 0.3)
      const cy = ay + (by - ay) * t + py * H * 0.012
      const R = W * (0.02 + r2() * 0.03)
      const gr = mg.createRadialGradient(cx, cy, 0, cx, cy, R)
      gr.addColorStop(0, "rgba(0,0,0,.4)")
      gr.addColorStop(1, "rgba(0,0,0,0)")
      mg.fillStyle = gr
      mg.fillRect(cx - R, cy - R, R * 2, R * 2)
    }
    g.globalAlpha = 0.75
    g.drawImage(mw, 0, 0)
    g.globalAlpha = 1

    const mX = W * MOON_X
    const mY = hy - MOON_ALT * H * 0.5
    const R = W * 0.14
    const mgl = g.createRadialGradient(mX, mY, 0, mX, mY, R)
    mgl.addColorStop(0, "rgba(200,215,255,.22)")
    mgl.addColorStop(1, "rgba(200,215,255,0)")
    g.fillStyle = mgl
    g.fillRect(mX - R, mY - R, R * 2, R * 2)
    g.fillStyle = "#f1f3ff"
    g.beginPath()
    g.arc(mX, mY, 10 * s, 0, 7)
    g.fill()
    g.fillStyle = css(mix(SKY_TOP, SKY_MID, 0.4))
    g.globalAlpha = 0.92
    g.beginPath()
    g.arc(mX + 4.5 * s, mY - 2.5 * s, 9 * s, 0, 7)
    g.fill()
  }
  yield

  // Distant ranges and Åreskutan.
  const mountains = canvas(W, H)
  const mt = context(mountains)
  drawLayer(mt, W, H, s, far2, {
    top: "#26345d",
    bot: "#1a2446",
    yTop: 0.4,
    yBottom: 0.58,
    depth: 0.08,
    k: 2,
    la: 0.45,
    sa: 0.3,
    seed: 2,
    haze: 0.51,
  })
  drawLayer(mt, W, H, s, far, {
    top: "#2b3a66",
    bot: "#18223f",
    yTop: 0.42,
    yBottom: 0.62,
    depth: 0.1,
    k: 2.2,
    la: 0.5,
    sa: 0.35,
    tex: 400,
    seed: 4,
    haze: 0.41,
  })
  yield
  drawLayer(
    mt,
    W,
    H,
    s,
    sk,
    {
      top: "#3a4d7e",
      bot: "#1a2547",
      yTop: 0.3,
      yBottom: 0.72,
      depth: 0.22,
      k: 2.4,
      la: 0.6,
      sa: 0.45,
      tex: 1400,
      seed: 3,
      haze: 0.21,
    },
    (g, rr) => {
      g.lineCap = "round"
      // Gullies.
      g.strokeStyle = "rgba(5,10,30,.35)"
      for (let i = 0; i < 46; i++) {
        const x = W * (0.38 + rr() * 0.5)
        const y = sk(x) + rr() * H * 0.02
        const len = H * (0.04 + rr() * 0.12)
        const dx = (rr() - 0.5) * len * 0.5
        g.lineWidth = (0.6 + rr() * 2.2) * s
        g.beginPath()
        g.moveTo(x, y)
        g.quadraticCurveTo(x + dx * 0.3, y + len * 0.5, x + dx, y + len)
        g.stroke()
      }
      // Exposed rock on steep slopes.
      g.fillStyle = "rgba(6,10,26,.55)"
      for (let x = W * 0.34; x < W * 0.96; x += 5) {
        const y = sk(x)
        const sl = (sk(x + 10) - sk(x - 10)) / 20
        const a = rr()
        const b = rr()
        const c2 = rr()
        const e = rr()
        const h = (4 + rr() * 14) * s
        if (Math.abs(sl) < 0.5 || a < 0.4) continue
        g.beginPath()
        g.moveTo(x, y + (2 + b * 6) * s)
        g.lineTo(x + (3 + c2 * 5) * s, y + (4 + e * 8) * s + h * 0.3)
        g.lineTo(x + (b - 0.5) * 4 * s, y + h)
        g.lineTo(x - (2 + e * 4) * s, y + h * 0.4)
        g.fill()
      }
      for (const p of skP) strokePiste(g, p, "rgba(170,190,240,.18)")
      forest(
        g,
        rr,
        (x) => Math.max(sk(x), H * 0.62),
        H * 0.8,
        Math.round(W * H * 0.001),
        3,
        6,
        (x, y) => inPiste(skP, x, y, s)
      )
      // Summit hut and mast.
      g.fillStyle = "#141b30"
      g.fillRect(mx - 4 * s, my - 2.5 * s, 8 * s, 3.5 * s)
      g.fillStyle = "#2a3456"
      g.beginPath()
      g.moveTo(mx - 5 * s, my - 2.5 * s)
      g.lineTo(mx, my - 5 * s)
      g.lineTo(mx + 5 * s, my - 2.5 * s)
      g.fill()
      g.strokeStyle = "#2a3456"
      g.lineWidth = 0.8 * s
      g.beginPath()
      g.moveTo(mx + 3 * s, my)
      g.lineTo(mx + 3 * s, my - 14 * s)
      g.moveTo(mx + 1.2 * s, my - 9 * s)
      g.lineTo(mx + 4.8 * s, my - 9 * s)
      g.stroke()
    }
  )
  yield

  // Foothills, and the front slopes with pistes and cabins.
  const front = canvas(W, H)
  const fr = context(front)
  drawLayer(
    fr,
    W,
    H,
    s,
    mid,
    {
      top: "#2f3f6c",
      bot: "#161f3c",
      yTop: 0.68,
      yBottom: 0.82,
      depth: 0.1,
      k: 2,
      la: 0.5,
      sa: 0.4,
      tex: 300,
      seed: 9,
      haze: 0.12,
    },
    (g, rr) => {
      forest(
        g,
        rr,
        (x) => Math.max(mid(x), H * 0.72),
        H * 0.86,
        Math.round(W * H * 0.0014),
        4,
        9
      )
    }
  )
  yield
  const { warm } = getSprites()
  drawLayer(
    fr,
    W,
    H,
    s,
    near,
    {
      top: "#2c3b66",
      bot: "#141d38",
      yTop: 0.55,
      yBottom: 0.86,
      depth: 0.2,
      k: 2.2,
      la: 0.55,
      sa: 0.4,
      tex: 500,
      seed: 13,
      haze: 0.06,
    },
    (g, rr) => {
      for (const p of pistes) {
        strokePiste(g, p, "rgba(190,205,255,.28)")
        // Groomer lines.
        g.lineWidth = 0.5 * s
        g.strokeStyle = "rgba(255,255,255,.07)"
        for (const off of [-0.32, -0.1, 0.12, 0.32]) {
          g.beginPath()
          for (let t = 0; t <= 1; t += 0.02) {
            const [x, y] = p.at(t)
            const xx = x + off * p.w * (0.6 + 0.8 * t)
            if (t) g.lineTo(xx, y)
            else g.moveTo(xx, y)
          }
          g.stroke()
        }
        // Piste markers.
        g.fillStyle = "#3a4466"
        for (let t = 0.04; t < 1; t += 0.07) {
          const [x, y] = p.at(t)
          const off = p.w * (0.6 + 0.8 * t) * 0.55
          for (const sx of [-1, 1])
            g.fillRect(x + sx * off - 0.4 * s, y - 3 * s, 0.9 * s, 3 * s)
        }
      }
      forest(
        g,
        rr,
        near,
        H * 0.9,
        Math.round(W * H * 0.0026),
        6,
        17,
        (x, y) => inPiste(pistes, x, y, s) || inGondola(x, y)
      )
      // Cabins with lit windows.
      const cabs: [number, number, number, number][] = []
      for (let i = 0; i < 240; i++) {
        const x = -W * 0.05 + rr() * W * 0.52
        const top = near(x)
        const y = top + 30 * s + rr() * Math.max(1, shoreY - top - 40 * s)
        const a = rr()
        const b = rr()
        if (
          cabs.length >= 34 ||
          y > shoreY - 8 * s ||
          inPiste(pistes, x, y, s) ||
          inGondola(x, y)
        )
          continue
        cabs.push([x, y, a, b])
      }
      cabs.sort((a, b) => a[1] - b[1])
      for (const [x, y, a, b] of cabs) {
        const w = (6 + a * 3) * s
        const h = w * 0.62
        g.fillStyle = "#2c3b66"
        g.beginPath()
        g.ellipse(x, y, w * 1.1, h * 0.45, 0, 0, 7)
        g.fill()
        g.fillStyle = "#141a2e"
        g.fillRect(x - w / 2, y - h, w, h)
        g.fillStyle = "#3a4870"
        g.beginPath()
        g.moveTo(x - w / 2 - 1.2 * s, y - h)
        g.lineTo(x, y - h - h * 0.7)
        g.lineTo(x + w / 2 + 1.2 * s, y - h)
        g.fill()
        if (b > 0.85) continue
        for (const wx of [x - w * 0.28, x + w * 0.12]) {
          const R = 7 * s
          g.globalAlpha = 0.35
          g.drawImage(warm, wx + 0.8 * s - R, y - h * 0.5 - R, R * 2, R * 2)
          g.globalAlpha = 1
          g.fillStyle = "#ffd27a"
          g.fillRect(wx, y - h * 0.66, 1.7 * s, 1.7 * s)
        }
      }
      // Floodlights along the pistes.
      for (const p of pistes)
        for (let t = 0.02; t < 1; t += 0.045) {
          const [x, y] = p.at(t)
          const off = p.w * (0.6 + 0.8 * t) * 0.55
          for (const sx of [-1, 1]) {
            const lx = x + sx * off
            const R = 10 * s
            g.globalAlpha = 0.55
            g.drawImage(warm, lx - R, y - R, R * 2, R * 2)
            g.globalAlpha = 1
            g.fillStyle = "#fff1cf"
            g.fillRect(lx - 0.8, y - 0.8, 1.6, 1.6)
          }
        }
    }
  )
  yield

  // Village with road, railway, church and houses.
  const lights: [number, number][] = []
  const chim: [number, number][] = []
  const vil = canvas(W, H)
  {
    const g = context(vil)
    g.fillStyle = "#23315a"
    g.fillRect(0, shoreY, W, H * 0.06)
    g.fillStyle = "#141c33"
    g.fillRect(0, roadY - 1.3 * s, W, 2.6 * s)
    g.fillStyle = "#2a3350"
    g.fillRect(0, railY, W, 0.8 * s)
    g.fillRect(0, railY + 1.8 * s, W, 0.6 * s)
    // Åre Old Church.
    const chx = W * 0.445
    const chy = shoreY + H * 0.004
    g.fillStyle = "#1a2238"
    g.fillRect(chx - 6 * s, chy - 7 * s, 13 * s, 7 * s)
    g.fillRect(chx - 10 * s, chy - 13 * s, 4.5 * s, 13 * s)
    g.fillStyle = "#2c3350"
    g.beginPath()
    g.moveTo(chx - 7 * s, chy - 7 * s)
    g.lineTo(chx + 0.5 * s, chy - 11 * s)
    g.lineTo(chx + 8 * s, chy - 7 * s)
    g.fill()
    g.beginPath()
    g.moveTo(chx - 10.5 * s, chy - 13 * s)
    g.lineTo(chx - 7.75 * s, chy - 22 * s)
    g.lineTo(chx - 5 * s, chy - 13 * s)
    g.fill()
    g.fillStyle = "#ffd98c"
    for (let k = 0; k < 3; k++) {
      const wx = chx - 4 * s + k * 3.6 * s
      g.fillRect(wx, chy - 5 * s, 1.4 * s, 2.6 * s)
      lights.push([wx, chy - 5 * s])
    }
    // Houses, clustered in two parts of the village.
    const rr = rng(21)
    const hs = []
    for (let i = 0; i < 110; i++) {
      const cluster = rr() < 0.55 ? 0.52 : 0.74
      const x = W * (cluster + (rr() + rr() + rr() - 1.5) * 0.16)
      const row = rr()
      hs.push({
        x,
        y: shoreY + row * H * 0.017,
        w: (5 + rr() * 10) * s,
        h: (4 + rr() * 7) * s * (1 - row * 0.3),
        c: rr(),
        win: rr(),
        big: rr() < 0.07,
      })
    }
    hs.sort((a, b) => a.y - b.y)
    for (const o of hs) {
      let { w, h } = o
      const { x, y } = o
      if (o.big) {
        w *= 3.2
        h *= 2.2
      }
      const rh = o.big ? h * 0.22 : h * 0.55
      if (!o.big && o.win > 0.5) {
        const cx = x + w * 0.22
        const cy = y - h - rh * 0.56
        g.fillStyle = "#1a2036"
        g.fillRect(cx - 0.8 * s, cy - 3 * s, 1.6 * s, 3.5 * s)
        chim.push([cx, cy - 3 * s])
      }
      g.fillStyle = "#10172a"
      g.fillRect(x - w / 2, y - h, w, h)
      g.fillStyle = "#34436b"
      g.beginPath()
      g.moveTo(x - w / 2 - 1.5 * s, y - h)
      g.lineTo(x, y - h - rh)
      g.lineTo(x + w / 2 + 1.5 * s, y - h)
      g.fill()
      const nw = Math.max(1, Math.floor(w / (4 * s)))
      const rows = o.big ? 4 : 1
      g.fillStyle = "#ffd27a"
      for (let row = 0; row < rows; row++)
        for (let k = 0; k < nw; k++) {
          if ((o.win * 97 + k * 13.7 + row * 7.3) % 1 >= 0.62) continue
          const wx = x - w / 2 + ((k + 0.5) * w) / nw - 0.9 * s
          const wy = y - h + ((row + 0.3) * h) / (rows + 0.2)
          g.fillRect(wx, wy, 1.8 * s, 1.8 * s)
          lights.push([wx, wy])
        }
    }
    // Street lights.
    for (let x = W * 0.18; x < W * 1.02; x += 26 * s) {
      g.fillStyle = "#232b45"
      g.fillRect(x, roadY - 8 * s, 0.7 * s, 7 * s)
      g.fillStyle = "#ffe2a8"
      g.fillRect(x - 0.6 * s, roadY - 8.6 * s, 1.9 * s, 1.2 * s)
      lights.push([x, roadY - 8 * s])
    }
    g.globalCompositeOperation = "lighter"
    g.globalAlpha = 0.28
    for (const [x, y] of lights) {
      const R = 8 * s
      g.drawImage(warm, x - R, y - R, R * 2, R * 2)
    }
  }
  yield

  // Frozen lake: base gradient under the reflection, and frost on top.
  const lakeH = Math.max(1, H - lakeTop)
  const lakeBase = canvas(W, lakeH)
  {
    const g = context(lakeBase)
    const lg = g.createLinearGradient(0, 0, 0, lakeH)
    lg.addColorStop(0, css(SKY_HOR))
    lg.addColorStop(1, css(mix(SKY_TOP, [0, 0, 0], 0.35)))
    g.fillStyle = lg
    g.fillRect(0, 0, W, lakeH)
  }
  const lakeOverlay = canvas(W, lakeH)
  {
    const g = context(lakeOverlay)
    const r3 = rng(88)
    g.globalAlpha = 0.45
    for (let i = 0; i < 22; i++) {
      const x = r3() * W
      const y = r3() * H * 0.3
      const rx = W * (0.04 + r3() * 0.12)
      const ry = H * (0.004 + r3() * 0.01)
      g.save()
      g.translate(x, y)
      g.scale(1, ry / rx)
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx)
      gr.addColorStop(0, "rgba(255,255,255,.16)")
      gr.addColorStop(1, "rgba(255,255,255,0)")
      g.fillStyle = gr
      g.fillRect(-rx, -rx, rx * 2, rx * 2)
      g.restore()
    }
    g.strokeStyle = "rgba(255,255,255,.1)"
    g.lineWidth = 0.7
    for (let i = 0; i < 36; i++) {
      let x = r3() * W
      let y = r3() * H * 0.3
      g.beginPath()
      g.moveTo(x, y)
      const n = 4 + r3() * 8
      for (let j = 0; j < n; j++) {
        x += (r3() - 0.5) * 50
        y += (r3() - 0.5) * 8
        g.lineTo(x, y)
      }
      g.stroke()
    }
    g.strokeStyle = "rgba(255,255,255,.16)"
    g.lineWidth = 1.4
    g.beginPath()
    g.ellipse(W * 0.66, H * 0.05, W * 0.2, H * 0.016, 0, 0, 7)
    g.stroke()
    g.strokeStyle = "rgba(255,255,255,.08)"
    g.beginPath()
    g.ellipse(W * 0.66, H * 0.05, W * 0.215, H * 0.021, 0, 0, 7)
    g.stroke()
    g.globalAlpha = 1
    const ig = g.createLinearGradient(0, 0, 0, lakeH)
    ig.addColorStop(0, "rgba(220,235,255,.10)")
    ig.addColorStop(0.3, "rgba(10,20,50,.15)")
    ig.addColorStop(1, "rgba(5,10,30,.55)")
    g.fillStyle = ig
    g.fillRect(0, 0, W, lakeH)
    g.fillStyle = "rgba(255,255,255,.18)"
    g.fillRect(0, 0, W, 1)
  }

  return {
    W,
    H,
    s,
    roadY,
    railY,
    lakeTop,
    bg,
    mountains,
    front,
    vil,
    lakeBase,
    lakeOverlay,
    aurora: canvas(W / 2, H / 4),
    auroraNoise: noise(99),
    pistes,
    skP,
    gon,
    chair,
    mast: [mx + 3 * s, my - 14 * s],
    starGroups,
    fogs,
    clouds,
    skiersN,
    skiersS,
    cars,
    lights: lights.filter((_, i) => i % 2 === 0).slice(0, 160),
    chim: chim.slice(0, 12),
  }
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  l: number
  z: number
}

export class SceneRenderer {
  private readonly cv: HTMLCanvasElement
  private readonly ctx: Ctx
  private readonly onReady: () => void
  /** false renders a single still frame (for reduced motion). */
  private readonly animate: boolean

  private raf = 0
  private rt: ReturnType<typeof setTimeout> | undefined
  private last: number | undefined
  private frameNo = 0

  private job: Generator<void, SceneState> | null = null
  private st: SceneState | null = null
  private parts: Particle[] = []
  private shoot: {
    x: number
    y: number
    vx: number
    vy: number
    life: number
  } | null = null

  constructor(
    cv: HTMLCanvasElement,
    { onReady, animate = true }: { onReady: () => void; animate?: boolean }
  ) {
    this.cv = cv
    // Opaque canvas: the sky covers every pixel, and it composites faster.
    const ctx = cv.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("Canvas 2D is not supported")
    this.ctx = ctx
    this.onReady = onReady
    this.animate = animate
  }

  start() {
    addEventListener("resize", this.onResize)
    this.rebuild()
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop)
      this.tick(now)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.rt)
    removeEventListener("resize", this.onResize)
    this.job = null
  }

  private onResize = () => {
    clearTimeout(this.rt)
    this.rt = setTimeout(() => this.rebuild(), 200)
  }

  private rebuild() {
    const box = this.cv.parentElement?.getBoundingClientRect()
    if (!box) return
    const W = Math.round(Math.max(320, box.width))
    const H = Math.round(Math.max(320, box.height))
    if (this.st && this.st.W === W && this.st.H === H) return
    this.job = buildScene(W, H)
  }

  private tick(now: number) {
    // Advance a pending build for up to ~8ms per frame, keeping the old
    // scene (if any) on screen meanwhile.
    if (this.job) {
      const t0 = performance.now()
      while (this.job && performance.now() - t0 < 8) {
        const step = this.job.next()
        if (!step.done) continue
        this.job = null
        this.st = step.value
        this.parts = []
        this.cv.width = step.value.W
        this.cv.height = step.value.H
        this.draw(now)
        this.onReady()
      }
      return
    }
    if (this.st && this.animate) this.draw(now)
  }

  private skier(
    k: Skier,
    list: Piste[],
    ss: number,
    dt: number,
    trail: string
  ) {
    const { ctx } = this
    k.u += dt / k.dur
    if (k.u > 1) {
      k.u = 0
      k.trail = []
    }
    const p = list[k.p]
    const [cx, y] = p.at(k.u)
    const w = p.w * (0.6 + 0.8 * k.u)
    const phi = k.u * Math.PI * k.turns + k.ph
    const x = cx + Math.sin(phi) * w * 0.36
    k.trail.push([x, y])
    if (k.trail.length > k.max) k.trail.shift()
    if (k.trail.length > 1) {
      ctx.strokeStyle = trail
      ctx.lineWidth = 0.8 * ss
      ctx.beginPath()
      ctx.moveTo(k.trail[0][0], k.trail[0][1])
      for (const q of k.trail) ctx.lineTo(q[0], q[1])
      ctx.stroke()
    }
    const cp = Math.cos(phi)
    // Snow spray at the end of each turn.
    if (ss > 0.7 && Math.abs(cp) < 0.22 && this.parts.length < 300)
      for (let i = 0; i < 2; i++)
        this.parts.push({
          x,
          y,
          vx: (Math.sign(Math.sin(phi)) * 14 + (Math.random() - 0.5) * 16) * ss,
          vy: -(8 + Math.random() * 14) * ss,
          l: 1,
          z: ss,
        })
    // Headlamp glow.
    const R = 7 * ss
    ctx.globalAlpha = 0.5
    ctx.drawImage(getSprites().warm, x - R, y - 3 * ss - R, R * 2, R * 2)
    ctx.globalAlpha = 1
    // Skis, legs, jacket and head.
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(cp * 0.4)
    ctx.strokeStyle = "#c9d3ea"
    ctx.lineWidth = 0.7 * ss
    ctx.beginPath()
    ctx.moveTo(-2.4 * ss, 0.3 * ss)
    ctx.lineTo(2.4 * ss, 0.3 * ss)
    ctx.stroke()
    ctx.fillStyle = "#1b2033"
    ctx.fillRect(-0.8 * ss, -2 * ss, 1.6 * ss, 2.2 * ss)
    ctx.fillStyle = k.c
    ctx.fillRect(-1.1 * ss, -4.3 * ss, 2.2 * ss, 2.5 * ss)
    ctx.fillStyle = "#fff3d2"
    ctx.beginPath()
    ctx.arc(0, -5.1 * ss, 0.85 * ss, 0, 7)
    ctx.fill()
    ctx.restore()
  }

  /** Redraws the aurora into its half-resolution buffer. */
  private drawAurora(st: SceneState, t: number) {
    const g = context(st.aurora)
    const { W, H } = st
    g.setTransform(0.5, 0, 0, 0.5, 0, 0)
    g.globalCompositeOperation = "source-over"
    g.globalAlpha = 1
    g.clearRect(0, 0, W, H / 2)
    g.globalCompositeOperation = "lighter"
    const cw = 10
    const pulse = 0.65 + 0.35 * Math.sin(t * 0.23)
    const strip = getSprites().auroraStrip
    for (let i = 0; i < 3; i++)
      for (let x = -10; x < W + 10; x += cw) {
        const n = st.auroraNoise(x * 0.0025 + t * 0.04 + i * 9)
        const yb =
          H * (0.2 + 0.07 * i) +
          Math.sin(x * 0.0032 + t * 0.12 + i * 2) * H * 0.05 +
          (n - 0.5) * H * 0.08
        const h =
          H * (0.1 + 0.16 * st.auroraNoise(x * 0.006 + t * 0.09 + i * 31))
        g.globalAlpha =
          pulse *
          (0.2 +
            0.8 * (0.5 + 0.5 * Math.sin(x * 0.018 + t * 0.6 + i * 1.7)) ** 2) *
          (i === 1 ? 0.9 : 0.5)
        g.drawImage(strip, x, yb - h, cw + 1, h * 1.12)
      }
  }

  private draw(now: number) {
    const st = this.st
    if (!st) return
    const { ctx } = this
    const { W, H, s } = st
    const sp = getSprites()
    const t = now / 1000
    const dt = Math.min(0.05, (now - (this.last ?? now)) / 1000)
    this.last = now
    this.frameNo++
    const cab = "rgba(160,175,220,.6)"
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"

    // Sky: stars, shooting stars, aurora and clouds.
    ctx.drawImage(st.bg, 0, 0)
    ctx.fillStyle = "#eef2ff"
    for (const g of st.starGroups) {
      ctx.globalAlpha = g.b * (0.55 + 0.45 * Math.sin(t * g.f + g.p))
      ctx.beginPath()
      for (const star of g.stars) ctx.rect(star.x, star.y, star.r, star.r)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (!this.shoot && Math.random() < 0.005)
      this.shoot = {
        x: W * (0.2 + Math.random() * 0.7),
        y: H * (0.05 + Math.random() * 0.25),
        vx: -(500 + Math.random() * 400),
        vy: 180 + Math.random() * 160,
        life: 1,
      }
    if (this.shoot) {
      const S = this.shoot
      S.x += S.vx * dt
      S.y += S.vy * dt
      S.life -= dt * 1.4
      const lg = ctx.createLinearGradient(
        S.x,
        S.y,
        S.x - S.vx * 0.12,
        S.y - S.vy * 0.12
      )
      lg.addColorStop(0, `rgba(255,255,255,${Math.max(0, 0.9 * S.life)})`)
      lg.addColorStop(1, "rgba(255,255,255,0)")
      ctx.strokeStyle = lg
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(S.x, S.y)
      ctx.lineTo(S.x - S.vx * 0.12, S.y - S.vy * 0.12)
      ctx.stroke()
      if (S.life <= 0) this.shoot = null
    }
    if (this.frameNo % 2 === 1) this.drawAurora(st, t)
    ctx.globalCompositeOperation = "lighter"
    ctx.drawImage(st.aurora, 0, 0, W, H / 2)
    ctx.globalCompositeOperation = "source-over"
    for (const c of st.clouds) {
      const dw = 420 * c.sc * s
      const dh = 150 * c.sc * s
      const x = ((c.x * W * 1.5 + t * c.v * s) % (W * 1.5)) - W * 0.25 - dw / 2
      ctx.globalAlpha = 0.55 * c.a
      ctx.drawImage(sp.clouds[c.k], x, c.y * H, dw, dh)
    }
    ctx.globalAlpha = 1

    // Mountains, with skiers and the chairlift on Åreskutan.
    ctx.drawImage(st.mountains, 0, 0)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const k of st.skiersS)
      this.skier(k, st.skP, 0.5 * s, dt, "rgba(215,228,255,.3)")
    ctx.strokeStyle = cab
    ctx.lineWidth = 0.6
    ctx.beginPath()
    for (const off of [0, 2.5 * s])
      for (let i = 0; i <= 20; i++) {
        const [x, y] = cpt(st.chair, H, i / 20, off)
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
    for (const u of [0.15, 0.38, 0.62, 0.85]) {
      const [x, y] = cpt(st.chair, H, u, 1.25 * s)
      ctx.moveTo(x, y - 1 * s)
      ctx.lineTo(x, y + 7 * s)
    }
    ctx.stroke()
    ctx.lineWidth = 0.8 * s
    ctx.beginPath()
    for (let i = 0; i < 10; i++)
      for (const dir of [0, 1]) {
        const u0 = (t * 0.012 + i / 10 + dir * 0.05) % 1
        const [x, y] = cpt(st.chair, H, dir ? 1 - u0 : u0, dir ? 2.5 * s : 0)
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + 2.6 * s)
        ctx.moveTo(x - 1.2 * s, y + 2.6 * s)
        ctx.lineTo(x + 1.2 * s, y + 2.6 * s)
      }
    ctx.stroke()
    // Blinking light on the summit mast.
    const [mx, my] = st.mast
    if (t % 1.6 < 0.28) {
      const R = 6 * s
      ctx.globalAlpha = 0.9
      ctx.drawImage(sp.red, mx - R, my - R, R * 2, R * 2)
      ctx.globalAlpha = 1
      ctx.fillStyle = "#ff4a4a"
      ctx.fillRect(mx - 0.8 * s, my - 0.8 * s, 1.6 * s, 1.6 * s)
    }

    // Valley fog.
    for (const f of st.fogs) {
      const R = f.r * W
      const x = ((f.x * W + t * f.v * W * 0.01) % (W * 1.4)) - W * 0.2
      ctx.globalAlpha = 0.11 * f.a
      ctx.drawImage(sp.fog, x - R, f.y * H - R * 0.22, R * 2, R * 0.44)
    }
    ctx.globalAlpha = 1

    // Front slopes: groomer, skiers and the gondola.
    ctx.drawImage(st.front, 0, 0)
    {
      const p = st.pistes[1]
      const u = 1 - ((t / 80) % 1)
      const [gx, gy] = p.at(u)
      const [ax, ay] = p.at(Math.max(0, u - 0.04))
      ctx.save()
      ctx.globalCompositeOperation = "lighter"
      ctx.translate(gx, gy - 2 * s)
      ctx.rotate(Math.atan2(ay - gy, ax - gx))
      const Lc = 60 * s
      const cg = ctx.createLinearGradient(0, 0, Lc, 0)
      cg.addColorStop(0, "rgba(255,244,210,.45)")
      cg.addColorStop(1, "rgba(255,244,210,0)")
      ctx.fillStyle = cg
      ctx.beginPath()
      ctx.moveTo(2 * s, -1 * s)
      ctx.lineTo(Lc, -Lc * 0.35)
      ctx.lineTo(Lc, Lc * 0.35)
      ctx.lineTo(2 * s, 1 * s)
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = "#8a2a20"
      ctx.fillRect(gx - 3 * s, gy - 3.5 * s, 6 * s, 3.5 * s)
      ctx.fillStyle = "#ffe7b0"
      ctx.fillRect(gx - 1.5 * s, gy - 3 * s, 2.4 * s, 1.3 * s)
      ctx.fillStyle = "#1b2033"
      ctx.fillRect(gx - 3.4 * s, gy - 0.6 * s, 6.8 * s, 1.2 * s)
      if (t % 1 < 0.5) {
        ctx.fillStyle = "#ffb020"
        ctx.fillRect(gx - 0.6 * s, gy - 4.8 * s, 1.2 * s, 1.2 * s)
      }
    }
    for (const k of st.skiersN)
      this.skier(k, st.pistes, s, dt, "rgba(215,228,255,.45)")
    ctx.fillStyle = "#dfe6ff"
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]
      q.x += q.vx * dt
      q.y += q.vy * dt
      q.vy += 50 * q.z * dt
      q.l -= dt * 1.6
      if (q.l <= 0) {
        this.parts.splice(i, 1)
        continue
      }
      ctx.globalAlpha = q.l * 0.85
      ctx.fillRect(q.x, q.y, 1.1 * q.z, 1.1 * q.z)
    }
    ctx.globalAlpha = 1
    const o2 = -4 * s
    ctx.strokeStyle = cab
    ctx.lineWidth = 0.8
    ctx.beginPath()
    for (const off of [0, o2])
      for (let i = 0; i <= 30; i++) {
        const [x, y] = gpt(st.gon, H, i / 30, off)
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
    const cabins: [number, number][] = []
    for (let k = 0; k < 7; k++)
      for (const dir of [0, 1]) {
        const u0 = (t * 0.016 + k / 7 + dir * 0.07) % 1
        const [x, y] = gpt(st.gon, H, dir ? 1 - u0 : u0, dir ? o2 : 0)
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + 4 * s)
        cabins.push([x, y])
      }
    ctx.stroke()
    ctx.lineWidth = 1.4 * s
    ctx.beginPath()
    for (const u of [0.2, 0.4, 0.6, 0.8]) {
      const [x, y] = gpt(st.gon, H, u, o2)
      ctx.moveTo(x, y - 2 * s)
      ctx.lineTo(x, y + 16 * s)
      ctx.moveTo(x - 4 * s, y)
      ctx.lineTo(x + 4 * s, y)
    }
    ctx.stroke()
    ctx.fillStyle = "#1c2440"
    const G = st.gon
    ctx.fillRect(G.x0 - 8 * s, G.y0 - 8 * s, 16 * s, 11 * s)
    ctx.fillRect(G.x1 - 7 * s, G.y1 - 9 * s, 14 * s, 10 * s)
    ctx.fillStyle = "#b02c66"
    for (const [x, y] of cabins)
      ctx.fillRect(x - 4 * s, y + 4 * s, 8 * s, 6.5 * s)
    ctx.fillStyle = "#ffe2a6"
    for (const [x, y] of cabins)
      ctx.fillRect(x - 3 * s, y + 5.2 * s, 6 * s, 2.2 * s)

    // Village, chimney smoke, cars and the train.
    ctx.drawImage(st.vil, 0, 0)
    for (let i = 0; i < st.chim.length; i++) {
      const [cx, cy] = st.chim[i]
      for (let j = 0; j < 6; j++) {
        const a = (t * 0.22 + j / 6 + i * 0.13) % 1
        const R = (2 + a * 7) * s
        const x = cx + a * 16 * s + Math.sin(a * 5 + i) * 2 * s
        ctx.globalAlpha = (1 - a) * 0.1
        ctx.drawImage(sp.puff, x - R, cy - a * 26 * s - R, R * 2, R * 2)
      }
    }
    ctx.globalAlpha = 1
    const span = W * 1.3
    ctx.globalCompositeOperation = "lighter"
    ctx.globalAlpha = 0.55
    const carPos = st.cars.map((c) => {
      let x = (c.o * span + t * c.v * s) % span
      if (c.dir < 0) x = span - x
      x -= W * 0.15
      const y = st.roadY + (c.dir > 0 ? -0.5 : 0.5) * s
      const hx = x + c.dir * 2.2 * s
      const R = 8 * s
      ctx.drawImage(sp.headlight, hx - R, y - R, R * 2, R * 2)
      return [x, y, hx, c.dir] as const
    })
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
    for (const [x, y, hx, dir] of carPos) {
      ctx.fillStyle = "#fff6e0"
      ctx.fillRect(hx - 0.5 * s, y - 0.5 * s, 1 * s, 1 * s)
      ctx.fillStyle = "#ff3b3b"
      ctx.fillRect(x - dir * 2.2 * s - 0.5 * s, y - 0.5 * s, 1 * s, 1 * s)
    }
    {
      const tx = ((t % 46) / 20) * (W * 1.8) - W * 0.5
      const ry = st.railY
      if (tx < W * 1.5) {
        const R = 26 * s
        ctx.globalCompositeOperation = "lighter"
        ctx.globalAlpha = 0.5
        ctx.drawImage(sp.warm, tx + 2 * s - R, ry - 2 * s - R, R * 2, R * 2)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
        for (let c = 0; c < 6; c++) {
          const x = tx - c * 24 * s
          if (x < -2 * s || x - 22 * s > W) continue
          ctx.fillStyle = "#1a2138"
          ctx.fillRect(x - 22 * s, ry - 4.2 * s, 22 * s, 3.8 * s)
          ctx.fillStyle = "#ffe9b8"
          for (let w = 0; w < 6; w++)
            ctx.fillRect(
              x - 20.5 * s + w * 3.5 * s,
              ry - 3.4 * s,
              2.2 * s,
              1.3 * s
            )
          ctx.fillStyle = "rgba(232,61,132,.7)"
          ctx.fillRect(x - 22 * s, ry - 1.4 * s, 22 * s, 0.6 * s)
        }
      }
    }

    // Frozen lake with a reflection of everything above it.
    const lt = st.lakeTop
    if (lt < H) {
      const k = 0.62
      const RD = Math.min(lt, (H - lt) / k + 4)
      ctx.drawImage(st.lakeBase, 0, lt)
      ctx.save()
      ctx.setTransform(1, 0, 0, -k, 0, lt * (1 + k))
      ctx.globalAlpha = 0.5
      ctx.drawImage(this.cv, 0, lt - RD, W, RD, 0, lt - RD, W, RD)
      ctx.restore()
      ctx.drawImage(st.lakeOverlay, 0, lt)
      ctx.fillStyle = "rgba(255,255,255,.06)"
      for (let i = 0; i < 26; i++) {
        const yy = lt + (i / 26) ** 1.7 * (H - lt)
        const xx = ((i * 137.5 + t * (8 + (i % 5) * 3)) % (W + 300)) - 150
        ctx.fillRect(xx, yy, 60 + ((i * 53) % 180), 1)
      }
      ctx.globalCompositeOperation = "lighter"
      ctx.fillStyle = "#ffc56a"
      // Shimmering reflections of the village lights, in 8 batches.
      for (let g = 0; g < 8; g++) {
        ctx.globalAlpha = 0.28 * (0.6 + 0.4 * Math.sin(t * 3 + g * 1.3))
        ctx.beginPath()
        for (let i = g; i < st.lights.length; i += 8) {
          const [lx, ly] = st.lights[i]
          ctx.rect(
            lx + Math.sin(t * 1.6 + i) * 0.8,
            lt + (lt - ly) * k,
            1.3 * s,
            (5 + ((i * 37) % 23)) * s
          )
        }
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"
    }
  }
}
