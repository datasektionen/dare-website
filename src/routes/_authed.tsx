import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

/** Layout route that guards every child route behind a signed-in user. */
export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        href: `/auth/login?redirect=${encodeURIComponent(location.href)}`,
        reloadDocument: true,
      })
    }
    return { user: context.user }
  },
  component: Outlet,
})
