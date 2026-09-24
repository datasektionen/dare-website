import {
  ArrowSquareOutIcon,
  EnvelopeSimpleIcon,
  IdentificationBadgeIcon,
  ShieldCheckIcon,
  TicketIcon,
} from "@phosphor-icons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { TicketReleaseEditor } from "@/components/admin/ticket-release-editor"
import { TicketReleaseHistory } from "@/components/admin/ticket-release-history"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import type { User } from "@/lib/auth/types"
import {
  ticketReleaseHistoryQuery,
  ticketReleaseQuery,
} from "@/lib/ticket-release/queries"
import { formatRelative, formatRelease } from "@/lib/time"

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · dÅre 27" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(ticketReleaseQuery),
      context.user.isAdmin &&
        context.queryClient.ensureQueryData(ticketReleaseHistoryQuery),
    ])
  },
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useRouteContext()
  const firstName = user.name.split(" ")[0] || user.kthid

  return (
    <main className="container mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[.3em] text-muted-foreground uppercase">
            Dashboard
          </span>
          <h1 className="font-heading text-2xl font-semibold">
            Hej, {firstName}!
          </h1>
          <p className="text-sm text-muted-foreground">
            {user.isAdmin
              ? "Du är med i dÅrestaben och kan styra startsidan härifrån."
              : "Här ser du din profil och när biljetterna släpps."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to="/" />}
        >
          Visa startsidan
          <ArrowSquareOutIcon data-icon="inline-end" />
        </Button>
      </header>

      {user.isAdmin ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
          <TicketReleaseEditor />
          <div className="flex flex-col gap-6">
            <ProfileCard user={user} />
            <TicketReleaseHistory />
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-2">
          <ProfileCard user={user} />
          <ReleaseCard />
        </div>
      )}
    </main>
  )
}

function ProfileCard({ user }: { user: User }) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
            {initials || "?"}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="truncate">{user.name}</CardTitle>
            {user.isAdmin ? (
              <Badge>
                <ShieldCheckIcon />
                Admin · dÅrestaben
              </Badge>
            ) : (
              <Badge variant="secondary">Medlem</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        <p className="flex items-center gap-2 text-muted-foreground">
          <IdentificationBadgeIcon className="size-4 shrink-0" />
          <span className="text-foreground">{user.kthid}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <EnvelopeSimpleIcon className="size-4 shrink-0" />
          <span className="truncate text-foreground">{user.email}</span>
        </p>
      </CardContent>
    </Card>
  )
}

/** Read-only release info for members who aren't admins. */
function ReleaseCard() {
  const { data } = useSuspenseQuery(ticketReleaseQuery)
  const at = new Date(data.at)
  const now = useNow()
  const released = now !== null && now >= at.getTime()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TicketIcon className="size-4" />
          Biljettsläpp
        </CardTitle>
        <CardDescription>
          {released
            ? "Biljetterna är släppta!"
            : "Håll utkik, biljetterna släpps"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm font-medium">{formatRelease(at, "sv")}</p>
        {now !== null && (
          <p className="text-xs text-muted-foreground">
            {formatRelative(at, now)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
