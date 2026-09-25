import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

/** Guards the dashboard pages that only dÅrestaben (admins) may use. */
export const Route = createFileRoute("/_authed/dashboard/_admin")({
  beforeLoad: ({ context }) => {
    if (!context.user.isAdmin) throw redirect({ to: "/dashboard" })
  },
  component: Outlet,
})
