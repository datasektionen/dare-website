import { describe, expect, it } from "vitest"
import { cleanName } from "./leaderboard"

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
