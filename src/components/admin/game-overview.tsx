import {
  ArrowCounterClockwiseIcon,
  GhostIcon,
  PlusIcon,
  ProhibitIcon,
} from "@phosphor-icons/react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useNow } from "@/hooks/use-now"
import { activityQuery } from "@/lib/activity/queries"
import { type AdminBan, shortId } from "@/lib/game/admin"
import {
  addBan,
  liftBan,
  resetLeaderboard,
  setGameSettings,
} from "@/lib/game/admin-functions"
import { BAN_LABELS } from "@/lib/game/anticheat"
import { BAN_KINDS, type BanKind } from "@/lib/game/constants"
import { gameOverviewQuery } from "@/lib/game/queries"
import { formatRelative, formatShort } from "@/lib/time"
import { cn } from "@/lib/utils"

const num = (n: number) => n.toLocaleString("sv-SE")

const errorToast = (title: string) => (error: unknown) =>
  toast.error(title, {
    description: error instanceof Error ? error.message : undefined,
  })

/** Refreshes everything about the game after an admin changes something. */
export function useRefreshGame() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["game"] }),
      queryClient.invalidateQueries({ queryKey: activityQuery.queryKey }),
    ])
}

/** Today's numbers, at a glance. */
export function GameStats({ onReview }: { onReview: () => void }) {
  const { data } = useSuspenseQuery({
    ...gameOverviewQuery,
    refetchInterval: 30_000,
  })
  const tiles = [
    { label: "Åk idag", value: data.today.runs },
    { label: "Spelare idag", value: data.today.players },
    {
      label: "Att granska",
      value: data.held,
      hint: `${num(data.today.flagged)} flaggade idag`,
      action: data.held > 0 ? onReview : undefined,
    },
    { label: "Stoppade idag", value: data.today.rejected },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t.label}</span>
            <span className="trail-sign text-3xl tabular-nums">
              {num(t.value)}
            </span>
            {t.action ? (
              <button
                type="button"
                onClick={t.action}
                className="w-fit cursor-pointer text-xs font-semibold underline-offset-4 hover:underline"
              >
                Granska nu
              </button>
            ) : (
              t.hint && (
                <span className="text-xs text-muted-foreground">{t.hint}</span>
              )
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SettingRow({
  id,
  title,
  description,
  checked,
  pending,
  onChange,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  pending: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </div>
  )
}

/** Saving on or off, holding flagged runs, and starting the board afresh. */
export function GameSettingsCard() {
  const { data } = useSuspenseQuery(gameOverviewQuery)
  const refresh = useRefreshGame()
  const [confirming, setConfirming] = useState(false)
  const set = useMutation({
    mutationFn: (v: {
      saving?: boolean
      holdFlagged?: boolean
      inNav?: boolean
    }) => setGameSettings({ data: v }),
    onSuccess: (_, v) =>
      toast.success(
        v.saving !== undefined
          ? v.saving
            ? "Topplistan tar emot nya åk"
            : "Topplistan är stängd för nya åk"
          : v.inNav !== undefined
            ? v.inNav
              ? "Puckopist syns på startsidan"
              : "Puckopist syns inte på startsidan"
            : v.holdFlagged
              ? "Flaggade åk väntar på granskning"
              : "Flaggade åk syns direkt"
      ),
    onError: errorToast("Kunde inte spara"),
    onSettled: refresh,
  })
  const reset = useMutation({
    mutationFn: () => resetLeaderboard(),
    onSuccess: () => toast.success("Topplistan är nollställd"),
    onError: errorToast("Kunde inte nollställa"),
    onSettled: refresh,
  })
  const pending = set.isPending ? set.variables : null
  const saving = pending?.saving ?? data.settings.saving
  const holdFlagged = pending?.holdFlagged ?? data.settings.holdFlagged
  const inNav = pending?.inNav ?? data.settings.inNav

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topplistan</CardTitle>
        <CardDescription>
          {data.best
            ? `Etta: ${data.best.name}, ${num(data.best.score)} p`
            : "Tom än så länge."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <SettingRow
          id="game-saving"
          title="Spara nya åk"
          description="Av: spelet funkar, men inget sparas."
          checked={saving}
          pending={set.isPending}
          onChange={(v) => set.mutate({ saving: v })}
        />
        <SettingRow
          id="game-nav"
          title="Länk på startsidan"
          description="En knapp till spelet i menyn på startsidan."
          checked={inNav}
          pending={set.isPending}
          onChange={(v) => set.mutate({ inNav: v })}
        />
        <SettingRow
          id="game-hold"
          title="Granska flaggade åk"
          description="Misstänkta åk syns först när någon godkänt dem."
          checked={holdFlagged}
          pending={set.isPending}
          onChange={(v) => set.mutate({ holdFlagged: v })}
        />
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {data.settings.since
              ? `Nollställd ${formatShort(new Date(data.settings.since))}`
              : "Aldrig nollställd"}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={reset.isPending}
            onClick={() => setConfirming(true)}
          >
            <ArrowCounterClockwiseIcon data-icon="inline-start" />
            Nollställ topplistan
          </Button>
        </div>
      </CardContent>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nollställa topplistan?</AlertDialogTitle>
            <AlertDialogDescription>
              Bara åk från och med nu räknas. De gamla finns kvar här.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                reset.mutate()
                setConfirming(false)
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

/** How long a ban lasts, in hours; null is until lifted. */
const DURATIONS = [
  { hours: 1, label: "1 h" },
  { hours: 24, label: "1 dag" },
  { hours: 24 * 7, label: "1 vecka" },
  { hours: null, label: "Tills vidare" },
] as const

export type BanTerms = {
  shadow: boolean
  hours: number | null
  reason: string
}

export const DEFAULT_TERMS: BanTerms = { shadow: true, hours: null, reason: "" }

/** Shadow or not, how long, and why: the same for every kind of ban. */
export function BanTermsFields({
  terms,
  onChange,
}: {
  terms: BanTerms
  onChange: (terms: BanTerms) => void
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ban-shadow">Skuggban</Label>
          <p className="text-xs text-muted-foreground">
            Spelaren märker inget, men inget de sparar syns.
          </p>
        </div>
        <Switch
          id="ban-shadow"
          checked={terms.shadow}
          onCheckedChange={(shadow) => onChange({ ...terms, shadow })}
        />
      </div>
      <Field>
        <FieldLabel>Hur länge</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <Button
              key={d.label}
              type="button"
              size="sm"
              variant={terms.hours === d.hours ? "default" : "outline"}
              onClick={() => onChange({ ...terms, hours: d.hours })}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </Field>
      <Field>
        <FieldLabel htmlFor="ban-reason">Anledning</FieldLabel>
        <Input
          id="ban-reason"
          value={terms.reason}
          maxLength={200}
          placeholder="Valfritt"
          onChange={(e) => onChange({ ...terms, reason: e.target.value })}
          className="text-base md:text-xs"
        />
      </Field>
    </>
  )
}

const KIND_PLACEHOLDER: Record<BanKind, string> = {
  name: "t.ex. ett fult ord",
  ip: "t.ex. 130.237.0.1",
  device: "Enhets-id (uuid)",
  fingerprint: "64 tecken hex",
}

/** Bans by hand: words in names, or an IP, device or fingerprint. */
function AddBanDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const refresh = useRefreshGame()
  const [kind, setKind] = useState<BanKind>("name")
  const [value, setValue] = useState("")
  const [terms, setTerms] = useState<BanTerms>({
    ...DEFAULT_TERMS,
    shadow: false,
  })
  const add = useMutation({
    mutationFn: () => addBan({ data: { kind, value, ...terms } }),
    onSuccess: () => {
      toast.success("Bannat")
      onOpenChange(false)
      setValue("")
    },
    onError: errorToast("Kunde inte banna"),
    onSettled: refresh,
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim()) add.mutate()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Lägg till ban</AlertDialogTitle>
          </AlertDialogHeader>
          <Field>
            <FieldLabel>Vad</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {BAN_KINDS.map((k) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={kind === k ? "default" : "outline"}
                  onClick={() => setKind(k)}
                >
                  {BAN_LABELS[k].label}
                </Button>
              ))}
            </div>
            <FieldDescription>{BAN_LABELS[kind].hint}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="ban-value">
              {kind === "name" ? "Text i namnet" : BAN_LABELS[kind].label}
            </FieldLabel>
            <Input
              id="ban-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={KIND_PLACEHOLDER[kind]}
              autoComplete="off"
              className="text-base md:text-xs"
            />
          </Field>
          <BanTermsFields terms={terms} onChange={setTerms} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Avbryt</AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={!value.trim() || add.isPending}
            >
              Banna
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function BanRow({ ban, now }: { ban: AdminBan; now: number | null }) {
  const refresh = useRefreshGame()
  const lift = useMutation({
    mutationFn: () => liftBan({ data: { id: ban.id } }),
    onSuccess: ({ lifted }) =>
      lifted ? toast.success("Bannet är hävt") : toast.info("Redan hävt"),
    onError: errorToast("Kunde inte häva"),
    onSettled: refresh,
  })
  const what =
    ban.kind === "name" ? `”${ban.value}”` : (ban.label ?? shortId(ban.value))
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="flex size-8 shrink-0 items-center justify-center bg-muted text-muted-foreground">
        {ban.shadow ? (
          <GhostIcon className="size-4" />
        ) : (
          <ProhibitIcon className="size-4" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">{what}</span>
          <Badge variant="outline">{BAN_LABELS[ban.kind].label}</Badge>
          {ban.shadow && <Badge variant="secondary">Skugga</Badge>}
        </span>
        <span className="text-[11px] text-muted-foreground sm:text-xs">
          {ban.createdByName}
          {now !== null && ` · ${formatRelative(new Date(ban.createdAt), now)}`}
          {" · "}
          {ban.expiresAt
            ? `till ${formatShort(new Date(ban.expiresAt))}`
            : "tills vidare"}
          {ban.reason && ` · ${ban.reason}`}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={lift.isPending}
        onClick={() => lift.mutate()}
      >
        Häv
      </Button>
    </li>
  )
}

/** Bans in force, with a way to lift them or add one by hand. */
export function GameBans() {
  const { data } = useSuspenseQuery(gameOverviewQuery)
  const now = useNow(30_000)
  const [adding, setAdding] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bannade</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.bans.length ? (
          <ul className={cn("flex flex-col divide-y")}>
            {data.bans.map((b) => (
              <BanRow key={b.id} ban={b} now={now} />
            ))}
          </ul>
        ) : (
          <p className="well px-3 py-6 text-center text-xs text-muted-foreground">
            Ingen är bannad.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setAdding(true)}
        >
          <PlusIcon data-icon="inline-start" />
          Lägg till ban
        </Button>
      </CardContent>
      <AddBanDialog open={adding} onOpenChange={setAdding} />
    </Card>
  )
}
