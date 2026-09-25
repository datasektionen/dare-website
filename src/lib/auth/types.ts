export type User = {
  kthid: string
  name: string
  email: string
  /** Had the `dare:admin` Hive permission when they logged in. */
  isAdmin: boolean
}
