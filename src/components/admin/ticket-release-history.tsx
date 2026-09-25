import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/hooks/use-now"
import { ticketReleaseHistoryQuery } from "@/lib/ticket-release/queries"
import { formatRelative, formatShort } from "@/lib/time"

/** Who changed the release time, and when. */
export function TicketReleaseHistory() {
  const { data, isPending } = useQuery(ticketReleaseHistoryQuery)
  const now = useNow(30_000)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ändringslogg</CardTitle>
        <CardDescription>
          De senaste ändringarna av biljettsläppet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : !data?.length ? (
          <p className="well px-3 py-6 text-center text-xs text-muted-foreground">
            Inga ändringar än. Tiden är standardvärdet.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l pl-4">
            {data.map((c, i) => (
              <li key={c.id} className="relative">
                <span
                  className={`absolute top-1 -left-[21px] size-2.5 rounded-full ring-4 ring-card ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`}
                />
                <p className="text-xs font-medium">
                  {formatShort(new Date(c.releaseAt))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.changedByName}{" "}
                  <span className="text-muted-foreground/70">
                    ({c.changedBy})
                  </span>
                  {" · "}
                  <time
                    dateTime={c.changedAt}
                    title={formatShort(new Date(c.changedAt))}
                  >
                    {now === null
                      ? formatShort(new Date(c.changedAt))
                      : formatRelative(new Date(c.changedAt), now)}
                  </time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
