import {
  ArrowCounterClockwiseIcon,
  CalendarBlankIcon,
  CheckIcon,
  EyeIcon,
  LightningIcon,
} from "@phosphor-icons/react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useState } from "react"
import { sv } from "react-day-picker/locale"
import { toast } from "sonner"
import { ReleasePreview } from "@/components/admin/release-preview"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useNow } from "@/hooks/use-now"
import { activityQuery } from "@/lib/activity/queries"
import { setTicketRelease } from "@/lib/ticket-release/functions"
import {
  ticketReleaseHistoryQuery,
  ticketReleaseQuery,
} from "@/lib/ticket-release/queries"
import {
  formatRelative,
  formatRelease,
  formatShort,
  fromSwedishTime,
  splitDuration,
  toSwedishTime,
} from "@/lib/time"

const dateLabel = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
})

/** `YYYY-MM-DD` <-> a local Date at midnight, for the calendar. */
const toLocalDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}
const fromLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Moves a Swedish date/time draft by `ms`. */
function shift(date: string, time: string, ms: number) {
  return toSwedishTime(new Date(fromSwedishTime(date, time).getTime() + ms))
}

/** Lets admins set when ticket sales open on the landing page. */
export function TicketReleaseEditor() {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(ticketReleaseQuery)
  const saved = new Date(data.at)
  const initial = toSwedishTime(saved)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [confirm, setConfirm] = useState<"past" | "now" | null>(null)
  const now = useNow()

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)
  const draft = valid ? fromSwedishTime(date, time) : saved
  const dirty = valid && draft.getTime() !== saved.getTime()
  const isReleased = now !== null && now >= saved.getTime()

  const mutation = useMutation({
    mutationFn: (at: Date) =>
      setTicketRelease({ data: { at: at.toISOString() } }),
    onSuccess: (res) => {
      queryClient.setQueryData(ticketReleaseQuery.queryKey, res)
      queryClient.invalidateQueries({
        queryKey: ticketReleaseHistoryQuery.queryKey,
      })
      queryClient.invalidateQueries({ queryKey: activityQuery.queryKey })
      const next = toSwedishTime(new Date(res.at))
      setDate(next.date)
      setTime(next.time)
      toast.success("Biljettsläppet är uppdaterat", {
        description: formatRelease(new Date(res.at), "sv"),
      })
    },
    onError: (error) =>
      toast.error("Kunde inte spara", {
        description: error instanceof Error ? error.message : undefined,
      }),
  })

  function save() {
    if (!dirty) return
    if (draft.getTime() <= Date.now()) setConfirm("past")
    else mutation.mutate(draft)
  }

  function reset() {
    setDate(initial.date)
    setTime(initial.time)
  }

  function nudge(ms: number) {
    const next = shift(date, time, ms)
    setDate(next.date)
    setTime(next.time)
  }

  const left = splitDuration(now === null ? 0 : saved.getTime() - now)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Släpptid</CardTitle>
            <CardDescription>
              Tiden som nedräkningen på startsidan räknar mot.
            </CardDescription>
          </div>
          {now !== null &&
            (isReleased ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-current" />
                Släppt
              </Badge>
            ) : (
              <Badge variant="secondary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Kommande
              </Badge>
            ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Current state at a glance. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Dagar", left.days],
              ["Timmar", left.hours],
              ["Minuter", left.minutes],
              ["Sekunder", left.seconds],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="well flex flex-col gap-0.5 px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                {label}
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {now === null ? "–" : String(v).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Editor. */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field>
                <FieldLabel htmlFor="release-date">Datum</FieldLabel>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        id="release-date"
                        variant="outline"
                        className="w-full justify-start font-normal capitalize"
                      />
                    }
                  >
                    <CalendarBlankIcon data-icon="inline-start" />
                    {valid ? dateLabel.format(toLocalDate(date)) : "Välj datum"}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      locale={sv}
                      weekStartsOn={1}
                      selected={toLocalDate(date)}
                      defaultMonth={toLocalDate(date)}
                      onSelect={(d) => {
                        if (!d) return
                        setDate(fromLocalDate(d))
                        setCalendarOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </Field>
              <Field>
                <FieldLabel htmlFor="release-time">Tid</FieldLabel>
                <Input
                  id="release-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
            </div>
            <FieldDescription>
              Svensk tid (Europe/Stockholm). Sommar- och vintertid hanteras
              automatiskt.
            </FieldDescription>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Justera
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["−1 dag", -864e5],
                    ["−1 h", -36e5],
                    ["+1 h", 36e5],
                    ["+1 dag", 864e5],
                    ["+1 vecka", 6048e5],
                  ] as const
                ).map(([label, ms]) => (
                  <Button
                    key={label}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => nudge(ms)}
                    disabled={!valid}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {dirty && (
              <div className="border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs">
                <p className="font-medium">Osparad ändring</p>
                <p className="text-muted-foreground">
                  {formatShort(saved)} → {formatShort(draft)}
                </p>
              </div>
            )}
          </div>

          {/* Live preview of the draft. */}
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <EyeIcon className="size-3" />
              Förhandsvisning
            </span>
            <ReleasePreview at={draft} />
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {data.updatedAt ? (
            <>
              Senast ändrad av{" "}
              <span className="font-medium text-foreground">
                {data.updatedBy}
              </span>{" "}
              <time
                dateTime={data.updatedAt}
                title={formatShort(new Date(data.updatedAt))}
              >
                {now === null
                  ? formatShort(new Date(data.updatedAt))
                  : formatRelative(new Date(data.updatedAt), now)}
              </time>
            </>
          ) : (
            "Standardtid, inte ändrad än."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirm("now")}
            disabled={mutation.isPending || isReleased}
          >
            <LightningIcon data-icon="inline-start" />
            Släpp nu
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            disabled={!dirty || mutation.isPending}
          >
            <ArrowCounterClockwiseIcon data-icon="inline-start" />
            Återställ
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || mutation.isPending}
          >
            <CheckIcon data-icon="inline-start" />
            {mutation.isPending ? "Sparar…" : "Spara"}
          </Button>
        </div>
      </CardFooter>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "now"
                ? "Släpp biljetterna nu?"
                : "Tiden har redan passerat"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "now"
                ? "Nedräkningen hoppar till noll och köpknappen visas direkt för alla besökare."
                : `${formatRelease(draft, "sv")} har redan varit. Biljetterna visas som släppta direkt för alla besökare.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <Button
              onClick={() => {
                mutation.mutate(confirm === "now" ? new Date() : draft)
                setConfirm(null)
              }}
            >
              {confirm === "now" ? "Släpp nu" : "Spara ändå"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
