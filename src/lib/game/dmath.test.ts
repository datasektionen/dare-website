import { describe, expect, it } from "vitest"
import { atan, cos, exp, hypot, sin } from "./dmath"

const xs = [
  -40,
  -7.3,
  -Math.PI,
  -1.2,
  -0.3,
  0,
  1e-9,
  0.25,
  0.5,
  1,
  1.9,
  3,
  12.5,
]

describe("deterministic maths", () => {
  it("matches Math closely", () => {
    for (const x of xs) {
      expect(sin(x)).toBeCloseTo(Math.sin(x), 13)
      expect(cos(x)).toBeCloseTo(Math.cos(x), 13)
      expect(atan(x)).toBeCloseTo(Math.atan(x), 13)
      expect(exp(x / 10)).toBeCloseTo(Math.exp(x / 10), 12)
    }
    expect(atan(1e9)).toBeCloseTo(Math.atan(1e9), 13)
    expect(hypot(3, 4)).toBe(5)
  })
})
