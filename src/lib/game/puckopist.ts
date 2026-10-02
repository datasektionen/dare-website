/*
 * Puckopist: an endless downhill ski game, after Pucko's winter game of the
 * same name. Collect Pucko cans, do backflips and avoid obstacles.
 *
 * This file is the game itself, without any drawing: the terrain, the skier's
 * physics and the scoring. World units are roughly pixels at scale 1, with y
 * pointing down, so the slope goes down to the right.
 *
 * The simulation is deterministic: the same seed and the same presses give
 * exactly the same run, in every browser and on the server (hence the maths
 * from `./dmath` rather than `Math`). Scores are checked by replaying a run's
 * presses on the server, so don't use `Math.random`, `Math.sin` and the like
 * in here.
 */

import { atan, cos, exp, hypot, sin } from "./dmath"

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
export const TICK_RATE = 120
const TICK = 1 / TICK_RATE
/** The state goes into the run's digest this often. */
const CHECK_EVERY = 60
/** Things well behind the skier are forgotten this often. */
const PRUNE_EVERY = 120
const SLIDE_DECAY = exp(-2.5 * TICK)
const SIN_BASE = sin(atan(BASE))
const SPIN_DECAY = exp(-10 * TICK)

/** Landing more than this far off the slope's angle is a crash. */
export const LAND_TOLERANCE = 0.9
/** Landing this close to the slope's angle is a perfect landing. */
const PERFECT = 0.2
const BIG_AIR = 1.1
const HUGE_AIR = 1.8

/** Just riding scores a point every this many metres: tricks are where the points are. */
export const METRES_PER_POINT = 5
export const CAN_POINTS = 10
/** Points per second in the air, for every jump that lands. */
const AIR_POINTS = 30
const FLIP_POINTS = 150
const PERFECT_POINTS = 75
const BIG_AIR_POINTS = 50
const HUGE_AIR_POINTS = 150
/** Landing flips one after another builds a combo, up to this multiplier. */
export const MAX_COMBO = 5
/** The combo ends after this long on the ground. */
export const COMBO_GRACE = 2.5

export type Obstacle = {
  /** The middle; it reaches `w / 2` either way. */
  x: number
  w: number
  h: number
  /** Rubble is a long, low stretch of stones. */
  kind: "rock" | "boulder" | "log" | "rubble"
  /**
   * How clearly it's signposted, from 1 (a big warning sign and a strong
   * glow, at the start) down to faint (no sign, a dim glow, far down).
   * Only for drawing.
   */
  cue: number
}
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
      hugeAir: boolean
      /** The multiplier the points got. */
      combo: number
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

/**
 * Points for a landing: for the time in the air (rounded to 5), the flips
 * (150 for one, 450 for a double, 900 for a triple), a perfect landing and
 * big air, all times the combo.
 */
export function trickPoints(l: {
  flips: number
  perfect: boolean
  /** Seconds in the air. */
  air: number
  combo: number
}) {
  const air = 5 * Math.round((l.air * AIR_POINTS) / 5)
  const flips = (FLIP_POINTS * l.flips * (l.flips + 1)) / 2
  const bonus =
    (l.perfect ? PERFECT_POINTS : 0) +
    (l.air > HUGE_AIR ? HUGE_AIR_POINTS : l.air > BIG_AIR ? BIG_AIR_POINTS : 0)
  return (air + flips + bonus) * l.combo
}

/**
 * How hard the piste is at `x`: `early` goes from 0 to 1 over the first
 * 1.8 km, `late` from 0 to 1 over the next 3.6 km, so it keeps getting harder
 * for anyone good enough to get that far.
 */
export function difficulty(x: number) {
  const d = Math.max(0, (x - START_X) / 36000)
  return { early: Math.min(1, d), late: Math.min(1, Math.max(0, (d - 1) / 2)) }
}

/** The speed the skier settles at, rising with distance. */
export function cruise(x: number) {
  const { early, late } = difficulty(x)
  return 430 + 250 * early + 150 * late
}

type Difficulty = ReturnType<typeof difficulty>

/**
 * Kicker shapes, in terrain samples: `ramp` long up to a lip angled `lip`
 * upwards, then `land` samples of `steep` landing and `out` back to the
 * piste. `air` is how long the trail of cans lasts.
 */
type Kicker = {
  ramp: number
  lip: number
  land: number
  steep: number
  out: number
  air: number
}

const KICKERS = {
  small: { ramp: 9, lip: 0.3, land: 20, steep: 0.85, out: 22, air: 0.5 },
  medium: { ramp: 12, lip: 0.5, land: 32, steep: 1, out: 32, air: 0.6 },
  big: { ramp: 16, lip: 0.8, land: 46, steep: 1.15, out: 40, air: 0.9 },
} satisfies Record<string, Kicker>

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
  /** Where the last obstacle ends, to keep the next one far enough away. */
  private clearAt = Number.NEGATIVE_INFINITY
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
    if (n < 2) this.rolling(x0, 0.12, null)
    else {
      // How likely each kind of stretch is. Obstacle runs, big kickers and
      // cliffs get more common further down.
      const kinds = [
        [0.24, () => this.rolling(x0, 0.15 + 0.45 * r() * r(), d)],
        [0.2, () => this.kicker(x0, this.kickerSize(d))],
        [0.1 + 0.04 * d.early, () => this.jumpLine(x0)],
        [0.18 + 0.1 * d.early + 0.08 * d.late, () => this.field(x0, d)],
        [0.11, () => this.drop(x0)],
        [0.05 + 0.05 * d.early, () => this.cliff(x0)],
      ] as const
      let p = r() * kinds.reduce((sum, [w]) => sum + w, 0)
      for (const [w, make] of kinds) {
        p -= w
        if (p < 0) {
          make()
          break
        }
      }
    }

    while (this.nextLight < this.end) {
      this.lights.push(this.nextLight)
      this.nextLight += 700 + r() * 500
    }
  }

  private push(slopes: number[]) {
    for (const s of slopes)
      this.heights.push(this.heights[this.heights.length - 1] + s * STEP)
  }

  /**
   * Rolling hills, from gentle waves to big rollers. Steep crests throw the
   * skier into the air, enough for a flip on the biggest.
   */
  private rolling(x0: number, amp: number, d: Difficulty | null) {
    const r = this.rand
    const len = 900 + Math.floor(r() * 800)
    const n = Math.round(len / STEP)
    const cycles = 1 + Math.floor(r() * 4)
    this.push(
      Array.from(
        { length: n },
        (_, i) => BASE + amp * sin((Math.PI * 2 * cycles * i) / n)
      )
    )
    // Only in the dips, where the skier is pressed into the snow: past a
    // crest they may be thrown into the air, and couldn't jump over it.
    const inDip = (x: number) => {
      const phase = ((cycles * (x - x0)) / (n * STEP)) % 1
      return phase > 0.5 && phase < 0.8
    }
    // Big rollers throw the skier too far to say where they land.
    if (d && amp < 0.35)
      this.addObstacles(
        x0 + 200,
        x0 + len - 150,
        Math.floor(r() * (1 + 2 * d.early + 2 * d.late)),
        d,
        { ok: inDip }
      )
    this.addCanRow(x0 + 120 + r() * (len - 500))
    if (amp >= 0.35) this.clearAt = this.end
  }

  /** A gentle run with obstacles to jump over. */
  private field(x0: number, d: Difficulty) {
    const r = this.rand
    // Longer, with more in it, further down.
    const len = 1100 + Math.floor(r() * 500 + 1600 * d.late)
    const n = Math.round(len / STEP)
    this.push(
      Array.from(
        { length: n },
        (_, i) => BASE * 0.85 + 0.05 * sin((Math.PI * 4 * i) / n)
      )
    )
    this.addObstacles(
      x0 + 200,
      x0 + len - 100,
      2 + Math.floor(d.early * 3 + d.late * 3),
      d,
      { long: true }
    )
    this.addCanRow(x0 + 150 + r() * (len - 450))
  }

  /** Bigger kickers get more common further down. */
  private kickerSize(d: Difficulty) {
    const p = this.rand()
    return p < 0.3 - 0.15 * d.early
      ? KICKERS.small
      : p < 0.75 - 0.2 * d.early
        ? KICKERS.medium
        : KICKERS.big
  }

  /**
   * A ramp that launches the skier over a steep landing, with cans along
   * the way through the air.
   */
  private kicker(x0: number, k: Kicker, runIn = 25) {
    const slopes = [
      ...Array<number>(runIn).fill(BASE),
      // Curved ramp up to the lip.
      ...Array.from(
        { length: k.ramp },
        (_, i) =>
          BASE - (BASE + k.lip) * ((i + 1) / k.ramp) * ((i + 1) / k.ramp)
      ),
      ...Array<number>(k.land).fill(k.steep),
      ...Array.from(
        { length: k.out },
        (_, i) => k.steep - (k.steep - BASE) * (i / k.out)
      ),
    ]
    this.push(slopes)

    // Cans along the path a skier at cruising speed flies off the lip.
    const lipX = x0 + (runIn + k.ramp) * STEP
    const lipY = this.at(lipX)
    const v = cruise(lipX) * 0.9
    const a = atan(-k.lip)
    for (let t = 0.12; t < k.air; t += 0.1) {
      const x = lipX + v * cos(a) * t
      const y = lipY + v * sin(a) * t + 0.5 * GRAVITY * t * t - 26
      if (y < this.at(x) - 30) this.cans.push({ x, y, taken: false })
    }
    // The skier may land anywhere up to here, so no obstacle comes too soon.
    this.clearAt = this.end
  }

  /** Two or three small kickers in a row, for a flip off each. */
  private jumpLine(x0: number) {
    const count = 2 + Math.floor(this.rand() * 2)
    for (let i = 0; i < count; i++)
      this.kicker(i ? this.end : x0, KICKERS.small, i ? 10 : 25)
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
    this.clearAt = this.end
  }

  /** A cliff: a long fall onto a steep landing, time for a double or triple. */
  private cliff(x0: number) {
    const slopes = [
      ...Array<number>(24).fill(BASE),
      ...Array<number>(26).fill(2.4),
      ...Array<number>(20).fill(1.4),
      ...Array.from({ length: 48 }, (_, i) => 1.4 - (1.4 - BASE) * (i / 48)),
    ]
    this.push(slopes)
    // A trail of cans dropping away from the edge.
    const edge = x0 + 24 * STEP
    for (let i = 0; i < 6; i++) {
      const x = edge + 40 + i * 55
      this.cans.push({ x, y: this.at(edge) - 30 + i * i * 9, taken: false })
    }
    this.clearAt = this.end
  }

  /**
   * Up to `count` obstacles between `from` and `to`, only where `ok`. Long
   * ones (logs and rubble that take a long jump) only where `long`, on even
   * ground where they lie flat.
   */
  private addObstacles(
    from: number,
    to: number,
    count: number,
    d: Difficulty,
    {
      ok = () => true,
      long = false,
    }: { ok?: (x: number) => boolean; long?: boolean } = {}
  ) {
    const r = this.rand
    // Never closer to the last obstacle (maybe from the segment before) than
    // a jump plus time to react: about 0.8 s in the air, with room for
    // landing further down a hill, and 0.55 s to spare at first, down to
    // 0.3 s far down. So every obstacle can be cleared, just with less time
    // to think the further down it is.
    const react = 0.55 - 0.15 * d.early - 0.1 * d.late
    const gap = (at: number) => cruise(at) * (1.05 + react)
    let x = Math.max(from, this.clearAt + gap(this.clearAt))
    for (let i = 0; i < count && x < to; i++) {
      x += r() * 160 * (1 - 0.4 * d.late)
      while (x < to && !ok(x)) x += STEP * 2
      if (x > to) break
      // Signposted less and less clearly further down, with some variety.
      const cue = Math.min(
        1,
        Math.max(
          0.12,
          1.05 - 0.55 * d.early - 0.45 * d.late + (r() - 0.5) * 0.35
        )
      )
      // The longest an obstacle can be here: growing further down, but
      // never more than 40% of a jump at this speed, so it can be cleared.
      const longest = long
        ? Math.min(60 + 150 * d.early + 70 * d.late, 0.4 * 0.78 * cruise(x))
        : 60
      const p = r()
      const add = (o: Omit<Obstacle, "x" | "cue">, at = x + o.w / 2) => {
        this.obstacles.push({ ...o, x: at, cue })
        return at + o.w / 2
      }
      let end: number
      if (p < 0.12 * d.early + 0.18 * d.late) {
        // A boulder: taller, so the jump has to come earlier.
        end = add({ w: 46 + r() * 8, h: 32 + r() * 6, kind: "boulder" })
      } else if (long && longest > 110 && p < 0.25 * d.early + 0.2) {
        end = add({
          w: 90 + r() * (longest - 90),
          h: 14 + r() * 5,
          kind: "rubble",
        })
      } else if (p < 0.55) {
        end = add({ w: 34 + r() * 10, h: 20 + r() * 8, kind: "rock" })
        // Further down, rocks come in pairs, to be cleared in one jump.
        if (r() < 0.45 * d.early)
          end = add(
            { w: 32 + r() * 8, h: 18 + r() * 6, kind: "rock" },
            end + 60 + r() * 30
          )
      } else end = add({ w: 40 + r() * (longest - 40), h: 18, kind: "log" })
      this.clearAt = end
      x = end + gap(end)
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

/** FNV-1a style mixing of a 32-bit integer into a hash. */
function mix(h: number, v: number) {
  let x = h
  for (let i = 0; i < 4; i++) {
    x = Math.imul(x ^ ((v >>> (i * 8)) & 0xff), 0x01000193)
  }
  return x >>> 0
}

/** One go down the piste. */
export class Run {
  readonly terrain: Terrain
  readonly skier: Skier
  status: "riding" | "crashed" = "riding"
  cans = 0
  trickPoints = 0
  /** Flips landed in a row (the combo multiplier); 0 without a combo. */
  combo = 0
  /** Seconds on the ground since the last landing, for the combo. */
  groundTime = 0
  /** Physics ticks ridden, up to and including the one that crashed. */
  ticks = 0
  /**
   * Every tick where jump was pressed or let go, as
   * `tick * 4 + (held ? 2 : 0) + (pressed ? 1 : 0)`: all it takes to replay
   * the run exactly.
   */
  readonly inputs: number[] = []
  /**
   * A running hash of the skier's state, mixed in every `CHECK_EVERY` ticks
   * and at the crash. A replay of the same presses gives the same digest, so
   * a run whose state was changed while playing doesn't match its replay.
   */
  digest = 0x811c9dc5

  private jumpBuffer = 0
  private jumped = false
  /** A flip only starts from a press made for it, not from holding on. */
  private spinArmed = false
  private acc = 0
  private held = false
  /** A press made between frames short enough to run no tick. */
  private pendingPress = false
  /** Where the crash happened; the slide after it doesn't count. */
  private endX: number | null = null

  constructor(seed: number) {
    this.terrain = new Terrain(seed)
    const y = this.terrain.height(START_X)
    this.skier = {
      x: START_X,
      y,
      v: cruise(START_X),
      vx: 0,
      vy: 0,
      angle: atan(this.terrain.slope(START_X)),
      spin: 0,
      grounded: true,
      air: 0,
      rot: 0,
    }
  }

  get distance() {
    const x = this.endX ?? this.skier.x
    return Math.max(0, Math.floor((x - START_X) / UNITS_PER_M))
  }

  get score() {
    return (
      Math.floor(this.distance / METRES_PER_POINT) +
      this.cans * CAN_POINTS +
      this.trickPoints
    )
  }

  /**
   * Advances by `dt` seconds. `held` is whether jump is held down, `pressed`
   * whether it was pressed since the last update.
   */
  update(dt: number, held: boolean, pressed: boolean): GameEvent[] {
    const events: GameEvent[] = []
    this.pendingPress ||= pressed
    this.acc = Math.min(this.acc + dt, 0.1)
    while (this.acc >= TICK) {
      this.acc -= TICK
      this.step(held, this.pendingPress, events)
      this.pendingPress = false
    }
    return events
  }

  /** Runs one physics tick. `update` for the game, used directly by replays. */
  step(held: boolean, pressed: boolean, events: GameEvent[] = []) {
    if (this.status === "crashed") {
      this.tick(held, events)
      return events
    }
    if (pressed || held !== this.held)
      this.inputs.push(this.ticks * 4 + (held ? 2 : 0) + (pressed ? 1 : 0))
    this.held = held
    if (pressed) {
      this.jumpBuffer = JUMP_BUFFER
      if (!this.skier.grounded) this.spinArmed = true
    }
    this.tick(held, events)
    this.ticks++
    // `endX` is set by a crash in this tick.
    if (this.endX !== null || this.ticks % CHECK_EVERY === 0) this.checkpoint()
    if (this.ticks % PRUNE_EVERY === 0) this.terrain.prune(this.skier.x)
    return events
  }

  private checkpoint() {
    const s = this.skier
    let h = this.digest
    for (const v of [
      this.ticks,
      Math.round(s.x * 16),
      Math.round(s.y * 16),
      Math.round((s.grounded ? s.v : s.vy) * 16),
      Math.round(s.angle * 1024),
      this.cans,
      this.trickPoints,
    ])
      h = mix(h, v)
    this.digest = h
  }

  private tick(held: boolean, events: GameEvent[]) {
    const s = this.skier
    const T = this.terrain
    const dt = TICK
    this.jumpBuffer -= dt

    if (this.status === "crashed") {
      // Slide to a stop in the snow.
      s.v *= SLIDE_DECAY
      s.x += s.v * dt
      s.y = T.height(s.x)
      return
    }

    if (s.grounded || s.air < COYOTE) {
      if (this.jumpBuffer > 0 && !this.jumped) {
        const a = atan(T.slope(s.x))
        const v = s.grounded ? s.v : hypot(s.vx, s.vy)
        const down = v * sin(a)
        s.vx = v * cos(a)
        s.vy = (s.grounded ? down : Math.min(down, s.vy)) - JUMP * cos(a)
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
      this.groundTime += dt
      if (this.groundTime > COMBO_GRACE) this.combo = 0
      const a = atan(T.slope(s.x))
      const target = cruise(s.x)
      // Steeper than average speeds up, flatter slows down.
      const pull = sin(a) - SIN_BASE
      // Settles back quickly after gaining speed in the air.
      const settle = s.v > target ? 1.4 : 0.6
      s.v += GRAVITY * pull * 0.55 * dt + (target - s.v) * settle * dt
      s.v = Math.min(MAX_SPEED, Math.max(target * 0.75, s.v))
      const vx = s.v * cos(a)
      const vy = s.v * sin(a)
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
        s.spin *= SPIN_DECAY
        // When not flipping, line up with the snow ahead, so landing only
        // takes care after a flip.
        const ahead = atan(T.slope(s.x + s.vx * 0.15))
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
    const a = atan(T.slope(s.x))
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
    // Keep the speed along the slope, but never stop dead (landing on the
    // uphill face of a kicker), as riding never goes slower either.
    s.v = Math.min(
      MAX_SPEED,
      Math.max(cruise(s.x) * 0.75, s.vx * cos(a) + s.vy * sin(a))
    )
    s.angle = a
    const flips = countFlips(s.rot)
    const perfect = Math.abs(off) < PERFECT && s.air > 0.35
    const bigAir = s.air > BIG_AIR
    const hugeAir = s.air > HUGE_AIR
    if (perfect) s.v *= 1.08
    this.groundTime = 0
    // Short hops off bumps score nothing.
    if (s.air > 0.3) {
      if (flips > 0 || hugeAir) this.combo = Math.min(MAX_COMBO, this.combo + 1)
      const combo = Math.max(1, this.combo)
      const points = trickPoints({ flips, perfect, air: s.air, combo })
      this.trickPoints += points
      events.push({
        kind: "land",
        flips,
        perfect,
        bigAir,
        hugeAir,
        combo,
        points,
      })
    }
    s.rot = 0
  }

  private crash(events: GameEvent[]) {
    const s = this.skier
    this.status = "crashed"
    this.endX = s.x
    this.combo = 0
    s.grounded = true
    s.v = Math.max(200, hypot(s.vx, s.vy) * 0.5)
    events.push({ kind: "crash" })
  }

  private collide(events: GameEvent[]) {
    if (this.status === "crashed") return
    const s = this.skier
    const T = this.terrain
    for (const o of T.obstacles) {
      if (Math.abs(o.x - s.x) > o.w / 2 + 10) continue
      // Its top right where the skier is (long ones follow the slope).
      if (s.y > T.height(s.x) - o.h + 6) {
        this.crash(events)
        return
      }
    }
    // The skier's middle, half a body up from the skis.
    const bx = s.x + sin(s.angle) * 24
    const by = s.y - cos(s.angle) * 24
    for (const c of T.cans) {
      if (c.taken || Math.abs(c.x - bx) > 40) continue
      if (hypot(c.x - bx, c.y - by) < 38) {
        c.taken = true
        this.cans++
        events.push({ kind: "can", x: c.x, y: c.y })
      }
    }
  }
}

/** The longest run the server replays: 30 minutes. */
export const MAX_TICKS = TICK_RATE * 60 * 30

/**
 * Replays a run from its seed and its `inputs`, until it crashes (or reaches
 * `maxTicks`). `extra` is how many inputs were left over after the crash, or
 * out of order, which a real run never has.
 */
export function replay(seed: number, inputs: number[], maxTicks = MAX_TICKS) {
  const run = new Run(seed)
  let i = 0
  let held = false
  let bad = 0
  while (run.status === "riding" && run.ticks < maxTicks) {
    let pressed = false
    // Entries for ticks already passed can't come from a real run.
    while (i < inputs.length && Math.floor(inputs[i] / 4) < run.ticks) {
      bad++
      i++
    }
    if (i < inputs.length && Math.floor(inputs[i] / 4) === run.ticks) {
      pressed = (inputs[i] & 1) === 1
      held = (inputs[i] & 2) === 2
      i++
    }
    run.step(held, pressed)
  }
  return { run, extra: bad + inputs.length - i }
}

/** `inputs` as differences from the previous entry, which are short to send. */
export function packInputs(inputs: number[]) {
  return inputs.map((v, i) => v - (i ? inputs[i - 1] : 0))
}

export function unpackInputs(packed: number[]) {
  const out: number[] = []
  let acc = 0
  for (const d of packed) {
    acc += d
    out.push(acc)
  }
  return out
}
