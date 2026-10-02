/*
 * Puckopist: an endless downhill ski game, after Pucko's winter game of the
 * same name. Collect Pucko cans, do backflips and avoid obstacles.
 *
 * This file is the game itself, without any drawing: the terrain, the skier's
 * physics and the scoring. World units are roughly pixels at scale 1, with y
 * pointing down, so the slope goes down to the right.
 */

/** Distance between terrain samples. */
export const STEP = 8
/** World units per metre, for the distance shown to the player. */
export const UNITS_PER_M = 20
export const START_X = 240
/** The average slope of the piste (dy/dx). */
const BASE = 0.34

export const GRAVITY = 1400
const JUMP = 600
/** Backflip rotation speed while holding, in rad/s. */
const SPIN = 9.5
/** Holding only starts a flip this long after leaving the ground. */
const SPIN_DELAY = 0.08
/** A jump can still start this long after leaving the ground. */
const COYOTE = 0.12
/** A press this long before touching down still jumps. */
const JUMP_BUFFER = 0.12
const MAX_SPEED = 950
/** Physics runs at a fixed rate, independent of the frame rate. */
const TICK = 1 / 120

/** Landing more than this far off the slope's angle is a crash. */
export const LAND_TOLERANCE = 0.9
/** Landing this close to the slope's angle is a perfect landing. */
const PERFECT = 0.2
const BIG_AIR = 1.1

export const CAN_POINTS = 10
const PERFECT_POINTS = 50
const BIG_AIR_POINTS = 25

export type Obstacle = { x: number; w: number; h: number; kind: "rock" | "log" }
export type Can = { x: number; y: number; taken: boolean }

export type Skier = {
  x: number
  y: number
  /** Speed along the slope while on the ground. */
  v: number
  vx: number
  vy: number
  angle: number
  spin: number
  grounded: boolean
  /** Seconds since leaving the ground. */
  air: number
  /** Rotation from flipping during this jump. */
  rot: number
}

export type GameEvent =
  | { kind: "jump" }
  | { kind: "can"; x: number; y: number }
  | {
      kind: "land"
      flips: number
      perfect: boolean
      bigAir: boolean
      points: number
    }
  | { kind: "crash" }

/** Seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Wraps an angle to [-π, π). */
export function wrapAngle(a: number) {
  const t = Math.PI * 2
  return ((((a + Math.PI) % t) + t) % t) - Math.PI
}

/** Full flips in a rotation, counting ones that are a little short. */
export function countFlips(rot: number) {
  return Math.floor((Math.abs(rot) + LAND_TOLERANCE) / (Math.PI * 2))
}

/** Points for a landing: 100 for a flip, 300 for a double, 600 for a triple. */
export function trickPoints(flips: number, perfect: boolean, bigAir: boolean) {
  return (
    (100 * flips * (flips + 1)) / 2 +
    (perfect ? PERFECT_POINTS : 0) +
    (bigAir ? BIG_AIR_POINTS : 0)
  )
}

/** How hard the piste is at `x`, from 0 to 1 over the first 2 km. */
function difficulty(x: number) {
  return Math.min(1, Math.max(0, (x - START_X) / 40000))
}

/** The speed the skier settles at, rising with distance. */
function cruise(x: number) {
  return 430 + 300 * difficulty(x)
}

/**
 * The piste: an endless profile built from segments (rolling hills, kickers,
 * drops and obstacle runs), generated ahead of the skier as needed, with the
 * obstacles, cans and floodlights placed along it.
 */
export class Terrain {
  obstacles: Obstacle[] = []
  cans: Can[] = []
  /** Floodlight poles along the piste, for decoration. */
  lights: number[] = []

  private heights = [0]
  /** Sample index of heights[0]; samples behind the skier are dropped. */
  private first = 0
  private segments = 0
  private nextLight = 600
  private readonly rand: () => number

  constructor(seed: number) {
    this.rand = rng(seed)
  }

  /** The x of the last generated sample. */
  get end() {
    return (this.first + this.heights.length - 1) * STEP
  }

  height(x: number) {
    this.ensure(x + STEP)
    return this.at(x)
  }

  /** The slope (dy/dx), smoothed over a ski's length. */
  slope(x: number) {
    return (this.height(x + 12) - this.height(x - 12)) / 24
  }

  ensure(x: number) {
    while (this.end < x) this.extend()
  }

  /** Forgets everything well behind `x`. */
  prune(x: number) {
    const drop = Math.floor((x - 1200) / STEP) - this.first
    if (drop <= 0) return
    this.heights.splice(0, drop)
    this.first += drop
    const min = this.first * STEP
    this.obstacles = this.obstacles.filter((o) => o.x > min)
    this.cans = this.cans.filter((c) => c.x > min && !c.taken)
    this.lights = this.lights.filter((l) => l > min)
  }

  /** Height without generating, for use while generating. */
  private at(x: number) {
    const f = Math.max(0, x / STEP - this.first)
    const i = Math.min(Math.floor(f), this.heights.length - 2)
    if (i < 0) return this.heights[0]
    const k = Math.min(1, f - i)
    return this.heights[i] + (this.heights[i + 1] - this.heights[i]) * k
  }

  private extend() {
    const r = this.rand
    const x0 = this.end
    const d = difficulty(x0)
    const n = this.segments++
    const p = r()
    if (n < 2) this.rolling(x0, 0.12, 0)
    else if (p < 0.38) this.rolling(x0, 0.15 + 0.3 * r(), d)
    else if (p < 0.6) this.kicker(x0)
    else if (p < 0.8) this.field(x0, d)
    else this.drop(x0)

    while (this.nextLight < this.end) {
      this.lights.push(this.nextLight)
      this.nextLight += 700 + r() * 500
    }
  }

  private push(slopes: number[]) {
    for (const s of slopes)
      this.heights.push(this.heights[this.heights.length - 1] + s * STEP)
  }

  /** Rolling hills. Steep crests throw the skier into the air. */
  private rolling(x0: number, amp: number, d: number) {
    const r = this.rand
    const len = 900 + Math.floor(r() * 800)
    const n = Math.round(len / STEP)
    const cycles = 1 + Math.floor(r() * 3)
    this.push(
      Array.from(
        { length: n },
        (_, i) => BASE + amp * Math.sin((Math.PI * 2 * cycles * i) / n)
      )
    )
    if (d > 0)
      this.addObstacles(x0 + 200, x0 + len - 150, Math.floor(r() * (1 + 2 * d)))
    this.addCanRow(x0 + 120 + r() * (len - 500))
  }

  /** A gentle run with obstacles to jump over. */
  private field(x0: number, d: number) {
    const r = this.rand
    const len = 1100 + Math.floor(r() * 500)
    const n = Math.round(len / STEP)
    this.push(
      Array.from(
        { length: n },
        (_, i) => BASE * 0.85 + 0.05 * Math.sin((Math.PI * 4 * i) / n)
      )
    )
    this.addObstacles(x0 + 200, x0 + len - 100, 2 + Math.floor(d * 3))
    this.addCanRow(x0 + 150 + r() * (len - 450))
  }

  /** A ramp that launches the skier over a steep landing, with cans in the air. */
  private kicker(x0: number) {
    const ramp = 12
    const slopes = [
      ...Array<number>(25).fill(BASE),
      // Curved ramp up to the lip.
      ...Array.from(
        { length: ramp },
        (_, i) => BASE - (BASE + 0.5) * ((i + 1) / ramp) ** 2
      ),
      ...Array<number>(32).fill(1),
      ...Array.from({ length: 32 }, (_, i) => 1 - (1 - BASE) * (i / 32)),
    ]
    this.push(slopes)

    // Cans along the path a skier at cruising speed flies off the lip.
    const lipX = x0 + (25 + ramp) * STEP
    const lipY = this.at(lipX)
    const v = cruise(lipX) * 0.9
    const a = Math.atan(-0.5)
    for (let t = 0.12; t < 0.6; t += 0.1) {
      const x = lipX + v * Math.cos(a) * t
      const y = lipY + v * Math.sin(a) * t + 0.5 * GRAVITY * t * t - 26
      if (y < this.at(x) - 30) this.cans.push({ x, y, taken: false })
    }
  }

  /** A sudden steep drop. */
  private drop(x0: number) {
    const slopes = [
      ...Array<number>(20).fill(BASE),
      ...Array<number>(18).fill(1.6),
      ...Array.from({ length: 36 }, (_, i) => 1.6 - (1.6 - BASE) * (i / 36)),
    ]
    this.push(slopes)
    this.addCanRow(x0 + 20 * STEP + 60, 90)
  }

  private addObstacles(from: number, to: number, count: number) {
    const r = this.rand
    // Far enough apart to land between them.
    const gap = 520
    let x = from
    for (let i = 0; i < count && x < to; i++) {
      x += r() * 200
      if (x > to) break
      const rock = r() < 0.6
      this.obstacles.push({
        x,
        w: rock ? 34 + r() * 10 : 58,
        h: rock ? 20 + r() * 8 : 18,
        kind: rock ? "rock" : "log",
      })
      x += gap
    }
  }

  /** A row of cans just above the snow, lifted over any obstacles. */
  private addCanRow(x0: number, lift = 26) {
    const count = 4 + Math.floor(this.rand() * 3)
    for (let i = 0; i < count; i++) {
      const x = x0 + i * 42
      const over = this.obstacles.some((o) => Math.abs(o.x - x) < o.w + 30)
      this.cans.push({ x, y: this.at(x) - (over ? 110 : lift), taken: false })
    }
  }
}

/** One go down the piste. */
export class Run {
  readonly terrain: Terrain
  readonly skier: Skier
  status: "riding" | "crashed" = "riding"
  cans = 0
  trickPoints = 0

  private jumpBuffer = 0
  private jumped = false
  /** A flip only starts from a press made for it, not from holding on. */
  private spinArmed = false
  private acc = 0

  constructor(seed: number) {
    this.terrain = new Terrain(seed)
    const y = this.terrain.height(START_X)
    this.skier = {
      x: START_X,
      y,
      v: cruise(START_X),
      vx: 0,
      vy: 0,
      angle: Math.atan(this.terrain.slope(START_X)),
      spin: 0,
      grounded: true,
      air: 0,
      rot: 0,
    }
  }

  get distance() {
    return Math.max(0, Math.floor((this.skier.x - START_X) / UNITS_PER_M))
  }

  get score() {
    return this.distance + this.cans * CAN_POINTS + this.trickPoints
  }

  /**
   * Advances by `dt` seconds. `held` is whether jump is held down, `pressed`
   * whether it was pressed since the last update.
   */
  update(dt: number, held: boolean, pressed: boolean): GameEvent[] {
    const events: GameEvent[] = []
    if (pressed) {
      this.jumpBuffer = JUMP_BUFFER
      if (!this.skier.grounded) this.spinArmed = true
    }
    this.acc = Math.min(this.acc + dt, 0.1)
    while (this.acc >= TICK) {
      this.acc -= TICK
      this.tick(held, events)
    }
    this.terrain.prune(this.skier.x)
    return events
  }

  private tick(held: boolean, events: GameEvent[]) {
    const s = this.skier
    const T = this.terrain
    const dt = TICK
    this.jumpBuffer -= dt

    if (this.status === "crashed") {
      // Slide to a stop in the snow.
      s.v *= Math.exp(-2.5 * dt)
      s.x += s.v * dt
      s.y = T.height(s.x)
      return
    }

    if (s.grounded || s.air < COYOTE) {
      if (this.jumpBuffer > 0 && !this.jumped) {
        const a = Math.atan(T.slope(s.x))
        const v = s.grounded ? s.v : Math.hypot(s.vx, s.vy)
        const down = v * Math.sin(a)
        s.vx = v * Math.cos(a)
        s.vy = (s.grounded ? down : Math.min(down, s.vy)) - JUMP * Math.cos(a)
        if (s.grounded) {
          s.air = 0
          s.rot = 0
        }
        s.grounded = false
        this.jumped = true
        this.spinArmed = true
        this.jumpBuffer = 0
        events.push({ kind: "jump" })
      }
    }

    if (s.grounded) {
      const a = Math.atan(T.slope(s.x))
      const target = cruise(s.x)
      // Steeper than average speeds up, flatter slows down.
      const pull = Math.sin(a) - Math.sin(Math.atan(BASE))
      // Settles back quickly after gaining speed in the air.
      const settle = s.v > target ? 1.4 : 0.6
      s.v += GRAVITY * pull * 0.55 * dt + (target - s.v) * settle * dt
      s.v = Math.min(MAX_SPEED, Math.max(target * 0.75, s.v))
      const vx = s.v * Math.cos(a)
      const vy = s.v * Math.sin(a)
      const nx = s.x + vx * dt
      const flying = s.y + vy * dt + 0.5 * GRAVITY * dt * dt
      if (T.height(nx) > flying + 0.5) {
        // The snow falls away faster than gravity can follow: take off.
        s.grounded = false
        s.vx = vx
        s.vy = vy
        s.air = 0
        s.rot = 0
        s.x = nx
        s.y = flying
      } else {
        s.x = nx
        s.y = T.height(nx)
        s.angle = a
      }
    } else {
      s.air += dt
      s.vy += GRAVITY * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      if (held && this.spinArmed && s.air > SPIN_DELAY)
        s.spin += (-SPIN - s.spin) * Math.min(1, 14 * dt)
      else {
        s.spin *= Math.exp(-10 * dt)
        // When not flipping, line up with the snow ahead, so landing only
        // takes care after a flip.
        const ahead = Math.atan(T.slope(s.x + s.vx * 0.15))
        const off = wrapAngle(ahead - s.angle)
        if (Math.abs(off) < 1.2) s.angle += off * Math.min(1, 3 * dt)
      }
      s.angle += s.spin * dt
      s.rot += s.spin * dt
      if (s.y >= T.height(s.x)) this.land(events)
    }

    this.collide(events)
  }

  private land(events: GameEvent[]) {
    const s = this.skier
    const T = this.terrain
    const a = Math.atan(T.slope(s.x))
    const off = wrapAngle(s.angle - a)
    s.y = T.height(s.x)
    s.grounded = true
    s.spin = 0
    this.jumped = false
    this.spinArmed = false
    if (Math.abs(off) > LAND_TOLERANCE) {
      this.crash(events)
      return
    }
    // Keep the speed along the slope.
    s.v = Math.max(0, s.vx * Math.cos(a) + s.vy * Math.sin(a))
    s.angle = a
    const flips = countFlips(s.rot)
    const perfect = Math.abs(off) < PERFECT && s.air > 0.35
    const bigAir = s.air > BIG_AIR
    if (perfect) s.v *= 1.08
    const points = trickPoints(flips, perfect, bigAir)
    this.trickPoints += points
    // Short hops off bumps aren't worth mentioning.
    if (s.air > 0.3 || points > 0)
      events.push({ kind: "land", flips, perfect, bigAir, points })
    s.rot = 0
  }

  private crash(events: GameEvent[]) {
    const s = this.skier
    this.status = "crashed"
    s.grounded = true
    s.v = Math.max(200, Math.hypot(s.vx, s.vy) * 0.5)
    events.push({ kind: "crash" })
  }

  private collide(events: GameEvent[]) {
    if (this.status === "crashed") return
    const s = this.skier
    const T = this.terrain
    for (const o of T.obstacles) {
      if (Math.abs(o.x - s.x) > o.w / 2 + 10) continue
      if (s.y > T.height(o.x) - o.h + 6) {
        this.crash(events)
        return
      }
    }
    // The skier's middle, half a body up from the skis.
    const bx = s.x + Math.sin(s.angle) * 24
    const by = s.y - Math.cos(s.angle) * 24
    for (const c of T.cans) {
      if (c.taken || Math.abs(c.x - bx) > 40) continue
      if (Math.hypot(c.x - bx, c.y - by) < 38) {
        c.taken = true
        this.cans++
        events.push({ kind: "can", x: c.x, y: c.y })
      }
    }
  }
}
