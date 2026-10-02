import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * The link handed out to judges: logs them in (if needed) and goes straight
 * to scoring Jäger vs Minttu.
 */
export const Route = createFileRoute("/domare")({
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: "/dashboard/battle" })
    throw redirect({
      href: `/auth/login?redirect=${encodeURIComponent("/dashboard/battle")}`,
      reloadDocument: true,
    })
  },
})
