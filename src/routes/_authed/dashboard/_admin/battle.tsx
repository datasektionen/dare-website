import { MonitorPlayIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { BattleControls } from "@/components/admin/battle-controls"
import { PageHeader } from "@/components/dashboard/page-header"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/hooks/use-now"
import { battleStatsQuery } from "@/lib/activity/queries"
import { battleLogQuery, battleQuery } from "@/lib/battle/queries"
import { featuresQuery } from "@/lib/settings/queries"
import { formatRelative } from "@/lib/time"

export const Route = createFileRoute("/_authed/dashboard/_admin/battle")({
  staticData: { title: "Jäger vs Minttu" },
  head: () => ({ meta: [{ title: "Jäger vs Minttu · Dashboard · dÅre 27" }] }),
  beforeLoad: async ({ context }) => {
    const features = await context.queryClient.ensureQueryData(featuresQuery)
    if (!features.battle) throw redirect({ to: "/dashboard/installningar" })
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(battleQuery),
      context.queryClient.ensureQueryData(battleLogQuery),
      context.queryClient.ensureQueryData(battleStatsQuery),
    ]),
  component: BattlePage,
})

/** Who has given the most points this round. */
function Judges() {
  const { data } = useQuery(battleStatsQuery)
  const now = useNow(30_000)
  const top = data?.judges[0]?.hits ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flitigaste domare</CardTitle>
        <CardDescription>
          {data?.roundStartedAt && now !== null
            ? `Poäng denna rond, som började ${formatRelative(new Date(data.roundStartedAt), now)}.`
            : "Poäng som getts denna rond."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : !data.judges.length ? (
          <p className="well px-3 py-8 text-center text-xs text-muted-foreground">
            Inga poäng än denna rond.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {data.judges.map((j, i) => (
              <li key={j.by} className="flex items-center gap-3">
                <span className="w-4 text-xs text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <UserAvatar kthid={j.by} name={j.byName} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium">{j.byName}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {j.hits}
                    </span>
                  </div>
                  <div className="h-1 bg-muted">
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${(j.hits / top) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function BattlePage() {
  return (
    <>
      <PageHeader
        title="Jäger vs Minttu"
        description="Ge poäng till Jäger eller Minttu. Varje tryck syns direkt på storbildsskärmen."
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/battle" target="_blank" />}
          >
            <MonitorPlayIcon data-icon="inline-start" />
            Öppna storbildsskärmen
          </Button>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <BattleControls />
        <Judges />
      </div>
    </>
  )
}
