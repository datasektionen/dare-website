import { ArrowCounterClockwiseIcon, MinusIcon } from "@phosphor-icons/react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
  SIDE_BUTTON,
  SIDE_DOT,
  SIDE_TEXT,
} from "@/components/battle/side-styles"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import { battleLogQuery, battleQuery } from "@/lib/battle/queries"
import { jaegerShare, percentages, SIDE_NAMES } from "@/lib/battle/types"
import { useBattleActions } from "@/lib/battle/use-battle-actions"
import { useBattleStream } from "@/lib/battle/use-battle-stream"
import { formatRelative } from "@/lib/time"
import { cn } from "@/lib/utils"

const KIND_LABEL = { hit: "+1", undo: "−1", reset: "Nollställde" } as const

/** Lets admins score the Jäger vs Minttu battle shown on /battle. */
export function BattleControls() {
  const { data } = useSuspenseQuery(battleQuery)
  const { data: log } = useQuery(battleLogQuery)
  const { hit, undo, reset, resetting } = useBattleActions()
  const [confirmReset, setConfirmReset] = useState(false)
  const now = useNow(30_000)
  // Stay live when other admins score.
  useBattleStream()

  const share = jaegerShare(data)
  const [pj, pm] = percentages(data)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ställning</CardTitle>
        <CardDescription>Uppdateras live när någon ger poäng.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Live score. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between font-['Big_Shoulders_Display',sans-serif] font-black italic">
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl tabular-nums", SIDE_TEXT.jaeger)}>
                {data.jaeger}
              </span>
              <span className="text-sm text-muted-foreground">
                {pj.toFixed(1)}%
              </span>
            </div>
            <span className="text-lg text-muted-foreground">VS</span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">
                {pm.toFixed(1)}%
              </span>
              <span className={cn("text-4xl tabular-nums", SIDE_TEXT.minttu)}>
                {data.minttu}
              </span>
            </div>
          </div>
          <div className="relative h-3 -skew-x-12 overflow-hidden bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#ff3d2e,#ff7a1a)] transition-[width] duration-300"
              style={{ width: `${share * 100}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-[linear-gradient(90deg,#2a7bff,#3dd6ff)] transition-[width] duration-300"
              style={{ width: `${(1 - share) * 100}%` }}
            />
            <div className="absolute inset-y-0 left-1/2 w-px bg-background/70" />
          </div>
        </div>

        {/* Big buttons: this is used on a phone at the party. */}
        <div className="grid grid-cols-2 gap-3">
          {(["jaeger", "minttu"] as const).map((side) => (
            <div key={side} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => hit(side)}
                className={cn(
                  "flex h-28 cursor-pointer flex-col items-center justify-center gap-1 transition-[transform,filter] duration-100 select-none active:scale-95 sm:h-32",
                  SIDE_BUTTON[side]
                )}
              >
                <span className="font-['Big_Shoulders_Display',sans-serif] text-5xl leading-none font-black italic">
                  +1
                </span>
                <span className="text-xs font-semibold tracking-[.25em] uppercase">
                  {SIDE_NAMES[side]}
                </span>
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => undo(side)}
                disabled={data[side] === 0}
              >
                <MinusIcon data-icon="inline-start" />
                Ta bort 1
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Tips: tryck{" "}
            <kbd className="bg-white px-1.5 py-0.5 font-medium text-foreground ring-1 ring-border">
              F
            </kbd>{" "}
            på /battle för helskärm.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmReset(true)}
            disabled={resetting || data.jaeger + data.minttu === 0}
          >
            <ArrowCounterClockwiseIcon data-icon="inline-start" />
            Nollställ
          </Button>
        </div>

        {!!log?.length && (
          <div className="flex flex-col gap-1.5">
            <h3 className="trail-sign text-sm">Senaste</h3>
            <ul className="flex flex-col gap-1 text-xs">
              {log.slice(0, 6).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        e.side ? SIDE_DOT[e.side] : "bg-muted-foreground"
                      )}
                    />
                    <span className="shrink-0 font-medium whitespace-nowrap">
                      {KIND_LABEL[e.kind]} {e.side ? SIDE_NAMES[e.side] : ""}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {e.byName}
                    </span>
                  </span>
                  <time
                    dateTime={e.at}
                    className="shrink-0 whitespace-nowrap text-muted-foreground"
                  >
                    {now === null ? "" : formatRelative(new Date(e.at), now)}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Starta en ny rond?</AlertDialogTitle>
            <AlertDialogDescription>
              Båda sidor sätts till 0 på storbildsskärmen. Det går inte att
              ångra, men alla tryck finns kvar i loggen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                reset()
                setConfirmReset(false)
              }}
            >
              Nollställ
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
