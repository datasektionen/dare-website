import { ArrowRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ActivityList } from "@/components/dashboard/activity-list"
import { PageHeader } from "@/components/dashboard/page-header"
import { SectionHeading } from "@/components/dashboard/section"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/hooks/use-now"
import { activityQuery } from "@/lib/activity/queries"
import { battleQuery } from "@/lib/battle/queries"
import { jaegerShare, leader, SIDE_NAMES, type Side } from "@/lib/battle/types"
import { featuresQuery } from "@/lib/settings/queries"
import { ticketReleaseQuery } from "@/lib/ticket-release/queries"
import { splitDuration, TIME_ZONE } from "@/lib/time"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authed/dashboard/")({
  staticData: { title: "Översikt" },
  loader: async ({ context }) => {
    if (context.user.isAdmin)
      await context.queryClient.ensureQueryData(activityQuery)
  },
  component: Overview,
})

const passDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
})
const passTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
})
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
})

/**
 * The ticket release as a lift pass: the date on the pass, and the time left
 * on a torn-off stub.
 */
function LiftPass({ editable }: { editable: boolean }) {
  const { data } = useSuspenseQuery(ticketReleaseQuery)
  const at = new Date(data.at)
  const now = useNow()
  const released = now !== null && now >= at.getTime()
  const d = splitDuration(now === null ? 0 : at.getTime() - now)
  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>Biljettsläpp</SectionHeading>
      <div className="flex min-h-44 shadow-[0_1px_2px_rgba(19,33,58,.06),0_8px_24px_-12px_rgba(19,33,58,.25)]">
        {/* The pass. */}
        <div className="relative flex min-w-0 flex-1 flex-col justify-between gap-6 overflow-hidden bg-white p-5 text-foreground ring-1 ring-border ring-inset">
          {/* A blue band across the top, like a resort lift pass. */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1.5 bg-(--piste-blue)"
          />
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold tracking-[.18em]">
            <span className="text-(--piste-blue)">LIFTKORT</span>
            <span className="hidden text-muted-foreground sm:inline">
              dÅre 27
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="trail-sign text-3xl first-letter:uppercase sm:text-4xl">
              {passDate.format(at)}
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              kl {passTime.format(at)} · biljetterna släpps
            </p>
          </div>
          {editable && (
            <Link
              to="/dashboard/biljettslapp"
              className="flex w-fit items-center gap-1.5 text-xs font-semibold underline-offset-4 hover:underline"
            >
              Ändra tid
              <ArrowRightIcon className="size-3.5" />
            </Link>
          )}
        </div>
        {/* Perforation: a column of punched holes where the stub tears off. */}
        <div
          aria-hidden
          className="w-2 shrink-0 bg-white bg-[radial-gradient(circle,#c4d2e1_1.5px,transparent_2px)] bg-size-[8px_9px] bg-center bg-repeat-y"
        />
        {/* The stub. */}
        <div className="flex w-32 shrink-0 flex-col items-center justify-center gap-1 bg-(--piste-red) px-2 text-white sm:w-40">
          {now === null ? (
            <Skeleton className="h-20 w-20 bg-white/20" />
          ) : released ? (
            <p className="trail-sign text-center text-3xl">Släppt!</p>
          ) : (
            (
              [
                [pad(d.days), "dagar"],
                [pad(d.hours), "tim"],
                [pad(d.minutes), "min"],
              ] as const
            ).map(([v, unit]) => (
              <p key={unit} className="flex items-baseline gap-1.5">
                <span className="trail-sign text-3xl tabular-nums sm:text-4xl">
                  {v}
                </span>
                <span className="w-9 text-[11px] font-semibold opacity-80">
                  {unit}
                </span>
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

const SIDE_COLOR: Record<Side, string> = {
  jaeger: "bg-[linear-gradient(90deg,#ff3d2e,#ff7a1a)]",
  minttu: "bg-[linear-gradient(90deg,#2a7bff,#3dd6ff)]",
}

/** The score as two rows; scoring happens on the Jäger vs Minttu page. */
function Battle() {
  const { data } = useSuspenseQuery(battleQuery)
  const share = jaegerShare(data)
  const lead = leader(data)
  const rows = [
    { side: "jaeger" as const, count: data.jaeger, share },
    { side: "minttu" as const, count: data.minttu, share: 1 - share },
  ]

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        actions={
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/battle" target="_blank" />}
          >
            Storbild
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
        }
      >
        Jäger vs Minttu
      </SectionHeading>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.side} className="flex items-center gap-3">
            <span className="trail-sign w-16 text-right text-3xl tabular-nums">
              {r.count}
            </span>
            <span className="w-14 text-sm font-medium">
              {SIDE_NAMES[r.side]}
            </span>
            <span className="h-2 flex-1 bg-muted">
              <span
                className={cn(
                  "block h-full transition-[width] duration-300",
                  SIDE_COLOR[r.side]
                )}
                style={{ width: `${r.share * 100}%` }}
              />
            </span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
              {Math.round(r.share * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {lead
            ? `${SIDE_NAMES[lead]} leder med ${Math.abs(data.jaeger - data.minttu)}.`
            : "Dödläge."}
        </p>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link to="/dashboard/battle" />}
        >
          Ge poäng
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </section>
  )
}

function Recent() {
  const { data } = useQuery(activityQuery)
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        actions={
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/dashboard/aktivitet" />}
          >
            Visa allt
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        }
      >
        Senast
      </SectionHeading>
      {data ? (
        <ActivityList items={data.slice(0, 8)} />
      ) : (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      )}
    </section>
  )
}

function Overview() {
  const { user } = Route.useRouteContext()
  const { data: features } = useSuspenseQuery(featuresQuery)
  const firstName = user.name.split(" ")[0] || user.kthid
  const showBattle = user.isAdmin && features.battle
  const date = today.format(new Date())

  return (
    <>
      <PageHeader
        title="Översikt"
        description={`${date[0].toUpperCase()}${date.slice(1)}. Välkommen, ${firstName}.`}
      />
      <div className="grid items-start gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          {/* On phones, the score comes first. */}
          {showBattle && (
            <div className="lg:order-last">
              <Battle />
            </div>
          )}
          {features.ticketRelease && <LiftPass editable={user.isAdmin} />}
        </div>
        {user.isAdmin && <Recent />}
      </div>
    </>
  )
}
