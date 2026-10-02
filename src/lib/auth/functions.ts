import { createMiddleware, createServerFn } from "@tanstack/react-start"
import { setResponseStatus } from "@tanstack/react-start/server"
import { isJudge } from "@/lib/battle/judges.server"
import { getAppSession } from "./session.server"
import type { User } from "./types"

/** Returns the signed-in user, or null. Safe to call from route loaders. */
export const getUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<User | null> => {
    const session = await getAppSession()
    const user = session.data.user
    if (!user) return null
    // Admins can do everything a judge can anyway.
    return { ...user, isJudge: !user.isAdmin && (await isJudge(user.kthid)) }
  }
)

/**
 * Server function middleware that rejects unauthenticated requests and puts
 * `user` on the context.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const session = await getAppSession()
    const user = session.data.user
    if (!user) {
      setResponseStatus(401)
      throw new Error("Du är inte inloggad.")
    }
    return next({ context: { user } })
  }
)

/** Like `authMiddleware`, but also requires the user to be an admin. */
export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user.isAdmin) {
      setResponseStatus(403)
      throw new Error("Endast dÅrestaben kan göra det här.")
    }
    return next()
  })
