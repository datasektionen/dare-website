export type User = {
  kthid: string
  name: string
  email: string
  /** Member of the admin Hive group (`ADMIN_GROUP`) when they logged in. */
  isAdmin: boolean
}
