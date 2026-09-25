import { describe, expect, it } from "vitest"
import { hasAdminPermission } from "./permissions"

describe("hasAdminPermission", () => {
  it("is true when SSO returns the admin permission", () => {
    expect(hasAdminPermission([{ id: "admin", scope: null }])).toBe(true)
    expect(
      hasAdminPermission([
        { id: "edit", scope: "events" },
        { id: "admin", scope: "" },
      ])
    ).toBe(true)
  })

  it("is false without it, and for guests (no claim)", () => {
    expect(hasAdminPermission([])).toBe(false)
    expect(hasAdminPermission([{ id: "edit", scope: null }])).toBe(false)
    expect(hasAdminPermission(undefined)).toBe(false)
    expect(hasAdminPermission("admin")).toBe(false)
  })
})
