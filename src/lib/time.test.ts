import { describe, expect, it } from "vitest"
import {
  formatRelative,
  formatRelease,
  fromSwedishTime,
  toSwedishTime,
} from "./time"

describe("Swedish time", () => {
  it("converts winter time (UTC+1)", () => {
    const at = fromSwedishTime("2026-11-04", "20:00")
    expect(at.toISOString()).toBe("2026-11-04T19:00:00.000Z")
    expect(toSwedishTime(at)).toEqual({ date: "2026-11-04", time: "20:00" })
  })

  it("converts summer time (UTC+2)", () => {
    const at = fromSwedishTime("2026-07-01", "12:30")
    expect(at.toISOString()).toBe("2026-07-01T10:30:00.000Z")
    expect(toSwedishTime(at)).toEqual({ date: "2026-07-01", time: "12:30" })
  })

  it("handles the days DST changes", () => {
    // Clocks go back at 03:00 on 25 Oct 2026, forward at 02:00 on 29 Mar.
    expect(fromSwedishTime("2026-10-25", "12:00").toISOString()).toBe(
      "2026-10-25T11:00:00.000Z"
    )
    expect(fromSwedishTime("2026-03-29", "12:00").toISOString()).toBe(
      "2026-03-29T10:00:00.000Z"
    )
  })

  it("formats in Swedish and English", () => {
    const at = new Date("2026-11-04T19:00:00Z")
    expect(formatRelease(at, "sv")).toBe("Onsdag 4 november 2026 · 20:00")
    expect(formatRelease(at, "en")).toBe("Wednesday 4 November 2026 · 20:00")
  })
})

describe("formatRelative", () => {
  const now = Date.parse("2026-09-24T18:00:00Z")
  it("counts days for far-off times", () => {
    expect(formatRelative(new Date("2026-11-04T19:00:00Z"), now)).toBe(
      "om 41 dagar"
    )
  })
  it("uses smaller units close by", () => {
    expect(formatRelative(new Date(now - 5 * 6e4), now)).toBe(
      "för 5 minuter sedan"
    )
    expect(formatRelative(new Date(now + 1000), now)).toBe("nu")
  })
})
