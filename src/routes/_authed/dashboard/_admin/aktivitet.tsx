import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { ActivityList } from "@/components/dashboard/activity-list"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Activity } from "@/lib/activity/functions"
import { activityQuery } from "@/lib/activity/queries"
import { featuresQuery } from "@/lib/settings/queries"
import { TIME_ZONE } from "@/lib/time"

const FILTERS = {
  alla: { label: "Alla", match: () => true },
  battle: {
    label: "Jäger vs Minttu",
    match: (a: Activity) => a.type === "battle",
  },
  biljettslapp: {
    label: "Biljettsläpp",
    match: (a: Activity) => a.type === "ticket-release",
  },
} as const
type Filter = keyof typeof FILTERS

export const Route = createFileRoute("/_authed/dashboard/_admin/aktivitet")({
  staticData: { title: "Aktivitet" },
  head: () => ({ meta: [{ title: "Aktivitet · Dashboard · dÅre 27" }] }),
  // The tab lives in the URL, so it survives reloads and can be shared.
  validateSearch: z.object({
    visa: z
      .enum(["alla", "battle", "biljettslapp"])
      .optional()
      .catch(undefined),
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(activityQuery),
      context.queryClient.ensureQueryData(featuresQuery),
    ]),
  component: ActivityPage,
})

const dayLabel = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
})

/** Groups consecutive items by Swedish calendar day. */
function byDay(items: Activity[]) {
  const groups: { day: string; items: Activity[] }[] = []
  for (const a of items) {
    const day = dayLabel.format(new Date(a.at))
    const last = groups.at(-1)
    if (last?.day === day) last.items.push(a)
    else groups.push({ day, items: [a] })
  }
  return groups
}

function ActivityPage() {
  const visa = Route.useSearch().visa ?? "alla"
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(activityQuery)
  const { data: features } = useSuspenseQuery(featuresQuery)
  // No tabs for features that are switched off.
  const tabs = (Object.keys(FILTERS) as Filter[]).filter(
    (k) =>
      (k !== "battle" || features.battle) &&
      (k !== "biljettslapp" || features.ticketRelease)
  )
  const items = data.filter(FILTERS[visa].match)
  const counts = Object.fromEntries(
    Object.entries(FILTERS).map(([k, f]) => [k, data.filter(f.match).length])
  ) as Record<Filter, number>

  return (
    <>
      <PageHeader
        title="Aktivitet"
        description="Allt dÅrestaben har ändrat, senast först."
      />
      {/* Scrolls sideways on narrow screens instead of widening the page. */}
      <Tabs
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0"
        value={visa}
        onValueChange={(v) =>
          navigate({
            search: { visa: v === "alla" ? undefined : (v as Filter) },
          })
        }
      >
        <TabsList>
          {tabs.map((k) => (
            <TabsTrigger key={k} value={k}>
              {FILTERS[k].label}
              <span className="ml-1.5 text-muted-foreground tabular-nums">
                {counts[k]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {items.length ? (
        <div className="flex flex-col gap-6">
          {byDay(items).map((g) => (
            <section key={g.day} className="flex flex-col gap-2">
              <h2 className="text-xs font-medium text-muted-foreground first-letter:uppercase">
                {g.day}
              </h2>
              <Card>
                <CardContent>
                  <ActivityList items={g.items} />
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <ActivityList items={[]} empty="Inget här än." />
      )}
    </>
  )
}
