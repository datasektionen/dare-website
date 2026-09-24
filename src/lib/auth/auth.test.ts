import { describe, expect, it } from "vitest"
import { safeRedirect } from "./redirect"

describe("safeRedirect", () => {
  it("keeps relative paths", () => {
    expect(safeRedirect("/dashboard?x=1")).toBe("/dashboard?x=1")
  })

  it("rejects external and protocol-relative URLs", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", ""]) {
      expect(safeRedirect(bad)).toBe("/")
    }
    expect(safeRedirect(null)).toBe("/")
  })
})
