import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { safeRedirect } from "@/lib/auth/redirect"

/**
 * A memorable address for logging in. Hands over to `/auth/login` (the OIDC
 * flow, a server route, so a full page load), or straight on if already
 * signed in. `?redirect=` picks where to end up; the dashboard by default.
 */
export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    const to = search.redirect ? safeRedirect(search.redirect) : "/dashboard"
    if (context.user) throw redirect({ href: to })
    throw redirect({
      href: `/auth/login?redirect=${encodeURIComponent(to)}`,
      reloadDocument: true,
    })
  },
})
