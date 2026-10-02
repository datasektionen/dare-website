import { describe, expect, it } from "vitest"
import { cleanName, isPlausible } from "./leaderboard"

describe("leaderboard names", () => {
  it("tidies whitespace and control characters", () => {
    expect(cleanName("  Ture \n Teknolog\u0000 ")).toBe("Ture Teknolog")
    expect(cleanName(" \t ")).toBe("")
  })

  it("keeps at most 20 characters, as Postgres counts them", () => {
    expect(cleanName("a".repeat(30))).toHaveLength(20)
    expect(Array.from(cleanName("⛷️".repeat(30)))).toHaveLength(20)
  })
})

describe("plausible scores", () => {
  it("accepts real runs", () => {
    expect(isPlausible({ score: 0, cans: 0, distance: 0 })).toBe(true)
    expect(isPlausible({ score: 103, cans: 4, distance: 63 })).toBe(true)
    // 1 200 m, 80 cans and 2 000 trick points.
    expect(isPlausible({ score: 4000, cans: 80, distance: 1200 })).toBe(true)
  })

  it("rejects scores that no run can give", () => {
    // Less than metres plus cans.
    expect(isPlausible({ score: 50, cans: 10, distance: 63 })).toBe(false)
    // Trick points that aren't a multiple of 25.
    expect(isPlausible({ score: 113, cans: 4, distance: 63 })).toBe(false)
    // Far too many cans or tricks for the distance.
    expect(isPlausible({ score: 10100, cans: 1000, distance: 100 })).toBe(false)
    expect(isPlausible({ score: 1_000_100, cans: 0, distance: 100 })).toBe(
      false
    )
  })
})
