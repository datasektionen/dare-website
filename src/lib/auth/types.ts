/** Who is logged in, as stored in the session cookie. */
export type SessionUser = {
  kthid: string
  name: string
  email: string
  /** Had the `$dare:admin` Hive permission when they logged in. */
  isAdmin: boolean
}

export type User = SessionUser & {
  /**
   * May score Jäger vs Minttu without being an admin. Looked up on every
   * request, so adding or removing a judge works without logging in again.
   */
  isJudge: boolean
}
