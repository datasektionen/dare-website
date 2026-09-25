import { useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  Outlet,
  useMatches,
} from "@tanstack/react-router"
import { Fragment } from "react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { SlopeBackdrop } from "@/components/dashboard/slope-backdrop"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { battleQuery } from "@/lib/battle/queries"
import { useBattleStream } from "@/lib/battle/use-battle-stream"
import { featuresQuery } from "@/lib/settings/queries"
import { ticketReleaseQuery } from "@/lib/ticket-release/queries"

export const Route = createFileRoute("/_authed/dashboard")({
  // Always the piste theme (a sunny ski day), whatever the site theme is.
  staticData: { siteHeader: false, piste: true, title: "Dashboard" },
  head: () => ({ meta: [{ title: "Dashboard · dÅre 27" }] }),
  loader: async ({ context }) => {
    const [features] = await Promise.all([
      context.queryClient.ensureQueryData(featuresQuery),
      context.queryClient.ensureQueryData(ticketReleaseQuery),
    ])
    if (context.user.isAdmin && features.battle)
      await context.queryClient.ensureQueryData(battleQuery)
  },
  component: DashboardLayout,
})

/** Keeps the Jäger vs Minttu score live on every dashboard page. */
function LiveBattle() {
  useBattleStream()
  return null
}

function Breadcrumbs() {
  const crumbs = useMatches({
    select: (matches) =>
      matches
        .filter((m) => m.staticData.title)
        .map((m) => ({ id: m.id, to: m.pathname, title: m.staticData.title })),
  })
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => (
          <Fragment key={c.id}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {i === crumbs.length - 1 ? (
                <BreadcrumbPage>{c.title}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link to={c.to} />}>
                  {c.title}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function DashboardLayout() {
  const { user } = Route.useRouteContext()
  const { data: features } = useSuspenseQuery(featuresQuery)

  return (
    <TooltipProvider>
      <SlopeBackdrop />
      {/* Flush sidebar and a see-through content area over the slope. */}
      <SidebarProvider>
        {user.isAdmin && features.battle && <LiveBattle />}
        <AppSidebar user={user} />
        <SidebarInset className="bg-transparent">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-1 data-vertical:h-4 data-vertical:self-center"
            />
            <Breadcrumbs />
          </header>
          <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
