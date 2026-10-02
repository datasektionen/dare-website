import { describe, expect, it } from "vitest"
import {
  countFlips,
  type GameEvent,
  LAND_TOLERANCE,
  Run,
  START_X,
  Terrain,
  trickPoints,
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

  it("scores bigger flips more", () => {
    expect(trickPoints(0, false, false)).toBe(0)
    expect(trickPoints(1, false, false)).toBe(100)
    expect(trickPoints(2, false, false)).toBe(300)
    expect(trickPoints(1, true, true)).toBe(175)
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
    expect(run.score).toBe(run.distance + run.cans * 10)
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
    expect(land).toMatchObject({ kind: "land", flips: 1 })
    expect(run.trickPoints).toBeGreaterThanOrEqual(100)
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
    run.terrain.obstacles.push({ x: START_X + 60, w: 40, h: 24, kind: "rock" })
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
