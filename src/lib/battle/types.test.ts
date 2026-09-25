import { describe, expect, it } from "vitest"
import { jaegerShare, leader, percentages } from "./types"

describe("battle maths", () => {
  it("is even with no votes", () => {
    expect(jaegerShare({ jaeger: 0, minttu: 0 })).toBe(0.5)
    expect(percentages({ jaeger: 0, minttu: 0 })).toEqual([50, 50])
    expect(leader({ jaeger: 0, minttu: 0 })).toBe(null)
  })

  it("splits the votes", () => {
    expect(jaegerShare({ jaeger: 3, minttu: 1 })).toBe(0.75)
    expect(percentages({ jaeger: 2, minttu: 1 })).toEqual([66.7, 33.3])
    expect(leader({ jaeger: 2, minttu: 5 })).toBe("minttu")
  })
})
