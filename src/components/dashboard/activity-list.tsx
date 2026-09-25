import { SIDE_DOT } from "@/components/battle/side-styles"
import { useNow } from "@/hooks/use-now"
import type { Activity } from "@/lib/activity/functions"
import { SIDE_NAMES } from "@/lib/battle/types"
import { FEATURE_NAMES } from "@/lib/settings/names"
import { formatRelative, formatShort } from "@/lib/time"
import { cn } from "@/lib/utils"
import { PisteMark } from "./piste-mark"
import { UserAvatar } from "./user-avatar"

function describe(a: Activity) {
  if (a.type === "feature")
    return `${a.enabled ? "slog på" : "stängde av"} ${FEATURE_NAMES[a.feature]}`
  if (a.type === "ticket-release")
    return `satte biljettsläppet till ${formatShort(new Date(a.releaseAt))}`
  if (a.kind === "reset") return "startade en ny rond"
  const side = a.side ? SIDE_NAMES[a.side] : ""
  return a.kind === "hit" ? `gav ${side} +1` : `tog bort 1 från ${side}`
}

/**
 * Who did it, with a small marker for what was changed: the piste marker of
 * its page, or the side's colour for Jäger vs Minttu points.
 */
function Who({ a }: { a: Activity }) {
  const side = a.type === "battle" ? a.side : null
  return (
    <span className="relative shrink-0">
      <UserAvatar kthid={a.by} name={a.byName} size="sm" className="size-7" />
      <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center bg-background">
        {a.type === "ticket-release" ? (
          <PisteMark piste="red" className="size-1.5" />
        ) : a.type === "feature" ? (
          <span className="size-1.5 bg-muted-foreground" />
        ) : (
          <span
            className={cn(
              "size-2 rounded-full",
              side ? SIDE_DOT[side] : "bg-muted-foreground"
            )}
          />
        )}
      </span>
    </span>
  )
}

/** A list of admin actions, newest first. */
export function ActivityList({
  items,
  empty = "Inget har hänt än.",
}: {
  items: Activity[]
  empty?: string
}) {
  const now = useNow(30_000)
  if (!items.length)
    return (
      <p className="well px-3 py-8 text-center text-xs text-muted-foreground">
        {empty}
      </p>
    )
  return (
    <ul className="flex flex-col divide-y">
      {items.map((a) => (
        <li
          key={a.id}
          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <Who a={a} />
          <p className="min-w-0 flex-1 text-xs leading-relaxed">
            <span className="font-medium">{a.byName}</span>{" "}
            <span className="text-muted-foreground">{describe(a)}</span>
          </p>
          <time
            dateTime={a.at}
            title={formatShort(new Date(a.at))}
            className="shrink-0 self-start pt-0.5 text-right text-[11px] text-muted-foreground tabular-nums sm:self-center sm:pt-0 sm:text-xs"
          >
            {now === null ? "" : formatRelative(new Date(a.at), now)}
          </time>
        </li>
      ))}
    </ul>
  )
}
