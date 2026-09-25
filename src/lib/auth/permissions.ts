/**
 * The Hive permission that makes someone an admin, i.e. `dare:admin`: the
 * permission `admin` in the Hive system `dare`. The system is the one set on
 * the `dare` client in SSO's admin panel, and SSO only returns permissions
 * within it, so the claim just contains `{ id: "admin" }`.
 */
export const ADMIN_PERMISSION = "admin"

type Permission = { id: string; scope: string | null }

function isPermission(p: unknown): p is Permission {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as Permission).id === "string"
  )
}

/**
 * Whether the `permissions` claim from SSO userinfo grants admin. The claim
 * is missing for guests, who are never admins.
 */
export function hasAdminPermission(claim: unknown): boolean {
  return (
    Array.isArray(claim) &&
    claim.some((p) => isPermission(p) && p.id === ADMIN_PERMISSION)
  )
}
