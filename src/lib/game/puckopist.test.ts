import { describe, expect, it } from "vitest"
import {
  countFlips,
  cruise,
  difficulty,
  type GameEvent,
  LAND_TOLERANCE,
  packInputs,
  Run,
  replay,
  rng,
  START_X,
  Terrain,
  trickPoints,
  unpackInputs,
  wrapAngle,
} from "./puckopist"

const FRAME = 1 / 60

/** Plays `seconds` of a run, holding jump for frames where `hold` is true. */
function play(
  run: Run,
  seconds: number,
  hold: (t: number) => boolean = () => false
) {
  const events: GameEvent[] = []
  let was = false
  for (let t = 0; t < seconds; t += FRAME) {
    const held = hold(t)
    events.push(...run.update(FRAME, held, held && !was))
    was = held
  }
  return events
}

describe("puckopist maths", () => {
  it("wraps angles", () => {
    expect(wrapAngle(0)).toBe(0)
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5)
    expect(wrapAngle(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5)
  })

  it("counts flips, including slightly short ones", () => {
    expect(countFlips(1)).toBe(0)
    expect(countFlips(-Math.PI * 2)).toBe(1)
    expect(countFlips(-(Math.PI * 2 - LAND_TOLERANCE / 2))).toBe(1)
    expect(countFlips(-Math.PI * 4.1)).toBe(2)
  })

  it("scores air, bigger flips and combos more", () => {
    const land = { flips: 0, perfect: false, air: 0, combo: 1 }
    expect(trickPoints(land)).toBe(0)
    // 0.5 s in the air: 15 points.
    expect(trickPoints({ ...land, air: 0.5 })).toBe(15)
    expect(trickPoints({ ...land, flips: 1 })).toBe(150)
    expect(trickPoints({ ...land, flips: 2 })).toBe(450)
    expect(trickPoints({ ...land, flips: 3 })).toBe(900)
    // Perfect, big air (1.2 s: 35 + 50) and a combo of 3.
    expect(trickPoints({ flips: 1, perfect: true, air: 1.2, combo: 3 })).toBe(
      (150 + 75 + 35 + 50) * 3
    )
  })
})

describe("terrain", () => {
  it("is the same for the same seed", () => {
    const a = new Terrain(7)
    const b = new Terrain(7)
    for (const x of [0, 500, 5000, 20000]) expect(a.height(x)).toBe(b.height(x))
    expect(a.obstacles).toEqual(b.obstacles)
  })

  it("goes downhill", () => {
    const t = new Terrain(3)
    expect(t.height(20000)).toBeGreaterThan(t.height(0) + 4000)
  })

  it("starts without obstacles", () => {
    const t = new Terrain(1)
    t.ensure(3000)
    const first = Math.min(...t.obstacles.map((o) => o.x))
    expect(first).toBeGreaterThan(1500)
  })
})

describe("run", () => {
  it("keeps going without input on the open piste", () => {
    const run = new Run(1)
    play(run, 2)
    expect(run.status).toBe("riding")
    expect(run.distance).toBeGreaterThan(30)
    // Riding alone is worth little: a point every 5 m.
    expect(run.score).toBe(Math.floor(run.distance / 5) + run.cans * 10)
  })

  it("only jumps from the ground", () => {
    const run = new Run(1)
    const events = play(run, 0.3, () => true)
    expect(events.filter((e) => e.kind === "jump")).toHaveLength(1)
    expect(run.skier.grounded).toBe(false)
  })

  it("lands a backflip", () => {
    const run = new Run(1)
    // Jump and hold for one flip.
    const events = play(run, 2, (t) => t < 0.8)
    const land = events.find((e) => e.kind === "land")
    expect(run.status).toBe("riding")
    expect(land).toMatchObject({ kind: "land", flips: 1, combo: 1 })
    expect(run.trickPoints).toBeGreaterThanOrEqual(150)
    expect(run.combo).toBe(1)
    // The combo ends after a while on the ground.
    play(run, 3)
    expect(run.combo).toBe(0)
  })

  it("crashes when landing on the head", () => {
    const run = new Run(1)
    // Let go halfway through the flip.
    const events = play(run, 2, (t) => t < 0.45)
    expect(events.some((e) => e.kind === "crash")).toBe(true)
    expect(run.status).toBe("crashed")
  })

  it("crashes into obstacles on the ground", () => {
    const run = new Run(1)
    run.terrain.obstacles.push({
      x: START_X + 60,
      w: 40,
      h: 24,
      kind: "rock",
      cue: 1,
    })
    const events = play(run, 0.5)
    expect(events.some((e) => e.kind === "crash")).toBe(true)
  })

  it("collects cans", () => {
    const run = new Run(1)
    const x = START_X + 60
    run.terrain.cans.push({ x, y: run.terrain.height(x) - 26, taken: false })
    const events = play(run, 0.5)
    expect(events.filter((e) => e.kind === "can")).toHaveLength(1)
    expect(run.cans).toBe(1)
  })
})

describe("slopes", () => {
  it("never crash a skier on their own", () => {
    for (const seed of [2, 3, 5, 8]) {
      const run = new Run(seed)
      while (run.status === "riding" && run.distance < 2500) {
        run.terrain.obstacles.length = 0
        run.step(false, false)
      }
      expect(run.status).toBe("riding")
    }
  })

  it("have kickers and cliffs with air for a double flip", () => {
    const run = new Run(21)
    let most = 0
    while (run.distance < 3000) {
      run.terrain.obstacles.length = 0
      const s = run.skier
      const T = run.terrain
      // Jump at the lips.
      const lip =
        s.grounded && T.slope(s.x + 10) < -0.15 && T.slope(s.x + 40) > 0
      run.step(false, lip)
      most = Math.max(most, s.air)
    }
    expect(most).toBeGreaterThan(1.4)
  })

  it("don't stop a skier landing on the uphill side of a kicker", () => {
    const run = new Run(1)
    const s = run.skier
    s.grounded = false
    s.vx = 100
    s.vy = 900
    s.y = run.terrain.height(s.x) - 1
    run.step(false, false)
    expect(s.grounded).toBe(true)
    expect(s.v).toBeGreaterThan(300)
  })
})

describe("obstacles", () => {
  it("come in more lengths, and get less signposted, further down", () => {
    const t = new Terrain(9)
    t.ensure(150000)
    const early = t.obstacles.filter((o) => o.x < 30000)
    const late = t.obstacles.filter((o) => o.x > 100000)
    const longest = (os: typeof early) => Math.max(...os.map((o) => o.w))
    expect(longest(late)).toBeGreaterThan(longest(early) + 50)
    const cue = (os: typeof early) =>
      os.reduce((sum, o) => sum + o.cue, 0) / os.length
    expect(cue(early)).toBeGreaterThan(0.8)
    expect(cue(late)).toBeLessThan(0.4)
  })

  it("hit a skier riding into the front of a long one on a slope", () => {
    const run = new Run(1)
    const x = START_X + 160
    run.terrain.obstacles.push({ x, w: 220, h: 16, kind: "rubble", cue: 1 })
    const events = play(run, 0.4)
    expect(events.some((e) => e.kind === "crash")).toBe(true)
  })
})

describe("difficulty", () => {
  it("keeps rising after the first stretch", () => {
    expect(difficulty(START_X)).toEqual({ early: 0, late: 0 })
    expect(difficulty(START_X + 36000)).toEqual({ early: 1, late: 0 })
    expect(difficulty(START_X + 72000).late).toBeCloseTo(0.5)
    expect(cruise(START_X + 108000)).toBeGreaterThan(cruise(START_X + 36000))
  })

  it("puts more obstacles further down", () => {
    let early = 0
    let late = 0
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const t = new Terrain(seed)
      t.ensure(120000)
      early += t.obstacles.filter((o) => o.x < 40000).length
      late += t.obstacles.filter((o) => o.x >= 80000 && o.x < 120000).length
      expect(t.obstacles.some((o) => o.kind === "boulder")).toBe(true)
    }
    expect(late).toBeGreaterThan(early * 1.2)
  })
})

/** Rides with random presses until crashing, like a (bad) player. */
function randomRun(seed: number) {
  const run = new Run(seed)
  const r = rng(seed + 1)
  let held = false
  // Uneven frame times, as in a browser.
  while (run.status === "riding" && run.ticks < 120 * 120) {
    const was = held
    if (r() < 0.04) held = !held
    run.update(1 / 60 + (r() - 0.5) / 200, held, held && !was)
  }
  return run
}

describe("replays", () => {
  it("give exactly the same run from the same presses", () => {
    for (const seed of [1, 42, 9001]) {
      const run = randomRun(seed)
      const { run: again, extra } = replay(seed, run.inputs)
      expect(extra).toBe(0)
      expect(again.status).toBe("crashed")
      expect(again.ticks).toBe(run.ticks)
      expect(again.digest).toBe(run.digest)
      expect(again.score).toBe(run.score)
      expect(again.cans).toBe(run.cans)
      expect(again.distance).toBe(run.distance)
    }
  })

  it("don't match a run whose state was changed", () => {
    const run = new Run(3)
    run.update(0.5, false, false)
    run.cans += 50
    while (run.status === "riding") run.update(1 / 60, false, false)
    expect(replay(3, run.inputs).run.digest).not.toBe(run.digest)
  })

  it("don't fit another piste", () => {
    const run = randomRun(7)
    expect(replay(8, run.inputs).run.digest).not.toBe(run.digest)
  })

  it("count entries that a real run can't have", () => {
    const run = randomRun(11)
    const { extra } = replay(11, [...run.inputs, (run.ticks + 50) * 4 + 3])
    expect(extra).toBe(1)
  })

  it("pack small", () => {
    const inputs = [3, 41, 400, 10_001]
    expect(packInputs(inputs)).toEqual([3, 38, 359, 9601])
    expect(unpackInputs(packInputs(inputs))).toEqual(inputs)
  })

  it("stop counting distance at the crash", () => {
    const run = randomRun(13)
    const at = run.distance
    run.update(1, false, false)
    expect(run.distance).toBe(at)
  })
})
