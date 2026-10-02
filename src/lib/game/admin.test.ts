import { describe, expect, it } from "vitest"
import { containsPattern, describeRemoval, isOnLeaderboard } from "./admin"

describe("name search", () => {
  it("matches names containing the search", () => {
    expect(containsPattern("kalle")).toBe("%kalle%")
    expect(containsPattern("")).toBe("%%")
  })

  it("matches wildcards literally", () => {
    expect(containsPattern("100%")).toBe("%100\\%%")
    expect(containsPattern("a_b")).toBe("%a\\_b%")
    expect(containsPattern("a\\b")).toBe("%a\\\\b%")
  })
})

describe("leaderboard", () => {
  it("is the top 5", () => {
    expect(isOnLeaderboard(1)).toBe(true)
    expect(isOnLeaderboard(5)).toBe(true)
    expect(isOnLeaderboard(6)).toBe(false)
  })
})

describe("removals in the activity log", () => {
  it("names the run and its score", () => {
    expect(describeRemoval({ name: "Kalle", runs: 1, bestScore: 1234 })).toBe(
      "tog bort ”Kalle” (1 234 p) från Puckopist"
    )
  })

  it("counts runs removed together", () => {
    expect(describeRemoval({ name: "Kalle", runs: 7, bestScore: 90 })).toBe(
      "tog bort 7 åk av ”Kalle” (bäst 90 p) från Puckopist"
    )
  })
})
