import { createMiddleware } from "@tanstack/react-start"
import { setResponseStatus } from "@tanstack/react-start/server"
import { authMiddleware } from "@/lib/auth/functions"
import { readFeatures } from "@/lib/settings/features.server"
import { isJudge } from "./judges.server"

/**
 * Server function middleware for scoring the battle: admins and judges,
 * while the battle is switched on.
 */
export const judgeMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user.isAdmin && !(await isJudge(context.user.kthid))) {
      setResponseStatus(403)
      throw new Error("Bara dÅrestaben och domare kan ge poäng.")
    }
    if (!(await readFeatures()).battle) {
      setResponseStatus(409)
      throw new Error("Jäger vs Minttu är avstängt.")
    }
    return next()
  })
