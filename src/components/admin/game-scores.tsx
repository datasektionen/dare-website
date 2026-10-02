import {
  CheckIcon,
  DesktopIcon,
  DotsThreeVerticalIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  ProhibitIcon,
  TrashIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react"
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type AdminScoreEntry,
  isOnLeaderboard,
  PAGE_SIZE,
  SCORE_VIEWS,
  type ScoreView,
  shortId,
} from "@/lib/game/admin"
import {
  addBan,
  approveAllHeld,
  banPlayer,
  moderateScore,
  removeScores,
} from "@/lib/game/admin-functions"
import { BAN_LABELS, FLAG_LABELS } from "@/lib/game/anticheat"
import type { ScoreStatus } from "@/lib/game/constants"
import { LEADERBOARD_SIZE } from "@/lib/game/leaderboard"
import { scoresQuery } from "@/lib/game/queries"
import { formatShort } from "@/lib/time"
import { cn } from "@/lib/utils"
import {
  type BanTerms,
  BanTermsFields,
  DEFAULT_TERMS,
  useRefreshGame,
} from "./game-overview"

const num = (n: number) => n.toLocaleString("sv-SE")

const VIEW_LABELS: Record<ScoreView, string> = {
  alla: "Alla",
  granska: "Att granska",
  flaggade: "Flaggade",
  dolda: "Dolda",
}

const STATUS_BADGES: Partial<
  Record<ScoreStatus, { label: string; hint: string }>
> = {
  held: {
    label: "Väntar",
    hint: "Syns inte förrän någon godkänt det.",
  },
  hidden: { label: "Dold", hint: "Dold av dÅrestaben." },
  shadow: {
    label: "Skugga",
    hint: "Från en skuggbannad spelare.",
  },
}

const errorToast = (title: string) => (error: unknown) =>
  toast.error(title, {
    description: error instanceof Error ? error.message : undefined,
  })

/** What the admin asked to remove, waiting for them to confirm. */
type Removal = { entry: AdminScoreEntry; all: boolean }

/** `value`, but only once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/**
 * Every saved Puckopist run, in views (to review, flagged, hidden),
 * searchable, with everything an admin can do to them.
 */
export function GameScores({
  view,
  device,
  onView,
  onDevice,
}: {
  view: ScoreView
  /** Only runs from this device. */
  device: string | null
  onView: (view: ScoreView) => void
  onDevice: (device: string | null) => void
}) {
  const [search, setSearch] = useState("")
  const q = useDebounced(search.trim(), 250)
  const key = `${view}/${device}/${q}`
  // "Visa fler" pages through one list; a new list starts from the top.
  const [more, setMore] = useState({ key, limit: PAGE_SIZE })
  const limit = more.key === key ? more.limit : PAGE_SIZE
  // Kept after closing, so the dialogs don't go blank while they fade out.
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [banning, setBanning] = useState<AdminScoreEntry | null>(null)
  const [banOpen, setBanOpen] = useState(false)
  const refresh = useRefreshGame()
  const { data, isPlaceholderData } = useQuery({
    ...scoresQuery({ q, view, device, limit }),
    // Keep the list on screen while a new search or page loads.
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: ({ entry, all }: Removal) =>
      removeScores({
        data: all ? { name: entry.name } : { id: entry.id },
      }),
    onSuccess: ({ removed }, { entry }) =>
      removed
        ? toast.success(
            removed === 1
              ? `Tog bort ”${entry.name}”`
              : `Tog bort ${removed} åk av ”${entry.name}”`
          )
        : toast.info("Redan borttaget", {
            description: "Någon annan hann före.",
          }),
    onError: errorToast("Kunde inte ta bort"),
    onSettled: refresh,
  })

  const moderate = useMutation({
    mutationFn: (v: {
      entry: AdminScoreEntry
      action: "approve" | "hide" | "show"
    }) => moderateScore({ data: { id: v.entry.id, action: v.action } }),
    onSuccess: ({ changed }, { entry, action }) =>
      changed
        ? toast.success(
            action === "approve"
              ? `Godkände ”${entry.name}”`
              : action === "hide"
                ? `Dolde ”${entry.name}”`
                : `”${entry.name}” syns igen`
          )
        : toast.info("Redan ändrat", {
            description: "Någon annan hann före.",
          }),
    onError: errorToast("Kunde inte ändra"),
    onSettled: refresh,
  })

  const approveAll = useMutation({
    mutationFn: () => approveAllHeld(),
    onSuccess: ({ approved }) => toast.success(`Godkände ${approved} åk`),
    onError: errorToast("Kunde inte godkänna"),
    onSettled: refresh,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Åk</CardTitle>
        <CardDescription>
          Bäst först. De {LEADERBOARD_SIZE} bästa syns i spelet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Scrolls sideways on narrow screens instead of widening the page. */}
        <Tabs
          className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0"
          value={view}
          onValueChange={(v) => onView(v as ScoreView)}
        >
          <TabsList>
            {SCORE_VIEWS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {VIEW_LABELS[v]}
                <span className="ml-1.5 text-muted-foreground tabular-nums">
                  {data ? num(data.views[v]) : "–"}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            {/* 16px on phones, so iOS doesn't zoom in when it's focused. */}
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök på namn"
              aria-label="Sök på namn"
              autoComplete="off"
              className="h-9 pr-9 pl-8 text-base md:text-xs [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Rensa sökningen"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setSearch("")}
              >
                <XIcon />
              </Button>
            )}
          </div>
          {device && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDevice(null)}
              aria-label="Visa alla enheter"
            >
              <DesktopIcon data-icon="inline-start" />
              Enhet {shortId(device)}
              <XIcon data-icon="inline-end" />
            </Button>
          )}
          {view === "granska" && !!data?.views.granska && (
            <Button
              size="sm"
              disabled={approveAll.isPending}
              onClick={() => approveAll.mutate()}
            >
              <CheckIcon data-icon="inline-start" />
              Godkänn alla {num(data.views.granska)}
            </Button>
          )}
        </div>

        {!data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data.entries.length ? (
          <p className="well px-3 py-8 text-center text-xs text-muted-foreground">
            {q
              ? `Inga namn innehåller ”${q}”.`
              : view === "granska"
                ? "Inget väntar på granskning."
                : view === "alla"
                  ? "Ingen har sparat ett åk än."
                  : "Inga åk här."}
          </p>
        ) : (
          <ol
            aria-label="Sparade åk"
            className={cn(
              "flex flex-col divide-y transition-opacity",
              isPlaceholderData && "opacity-60"
            )}
          >
            {data.entries.map((entry) => (
              <ScoreRow
                key={entry.id}
                entry={entry}
                filtered={!!device}
                onModerate={(action) => moderate.mutate({ entry, action })}
                onDevice={() => entry.device && onDevice(entry.device)}
                onBan={() => {
                  setBanning(entry)
                  setBanOpen(true)
                }}
                onRemove={(all) => {
                  setRemoval({ entry, all })
                  setConfirming(true)
                }}
              />
            ))}
          </ol>
        )}

        {data && data.entries.length < data.matching && (
          <div className="flex flex-col items-center gap-2 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Visar {num(data.entries.length)} av {num(data.matching)}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isPlaceholderData}
              onClick={() => setMore({ key, limit: limit + PAGE_SIZE })}
            >
              Visa fler
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          {removal && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="break-words">
                  {removal.all
                    ? `Ta bort alla ${removal.entry.sameName} åk av ”${removal.entry.name}”?`
                    : `Ta bort ”${removal.entry.name}”?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {removal.all
                    ? "Alla åk med det här namnet tas bort, oavsett stora och små bokstäver."
                    : `Åket med ${num(removal.entry.score)} poäng tas bort.`}{" "}
                  {!removal.all &&
                    isOnLeaderboard(removal.entry.rank) &&
                    "Det försvinner från topplistan direkt. "}
                  Det går inte att ångra.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => {
                    remove.mutate(removal)
                    setConfirming(false)
                  }}
                >
                  {removal.all
                    ? `Ta bort ${removal.entry.sameName} åk`
                    : "Ta bort"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <BanDialog entry={banning} open={banOpen} onOpenChange={setBanOpen} />
    </Card>
  )
}

/**
 * Bans whoever saved a run: by device, optionally fingerprint and IP. Runs
 * saved before devices were recorded can only have their name banned.
 */
function BanDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: AdminScoreEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const refresh = useRefreshGame()
  const [terms, setTerms] = useState<BanTerms>(DEFAULT_TERMS)
  const [fingerprint, setFingerprint] = useState(false)
  const [ip, setIp] = useState(false)
  const ban = useMutation({
    mutationFn: (e: AdminScoreEntry) =>
      e.device
        ? banPlayer({ data: { scoreId: e.id, fingerprint, ip, ...terms } })
        : addBan({ data: { kind: "name", value: e.name, ...terms } }).then(
            () => ({ bans: 1, hidden: 0 })
          ),
    onSuccess: ({ hidden }, e) => {
      toast.success(`Bannade ”${e.name}”`, {
        description: hidden
          ? `${hidden} av deras åk är dolda.`
          : "Inga av deras åk syntes.",
      })
      onOpenChange(false)
    },
    onError: errorToast("Kunde inte banna"),
    onSettled: refresh,
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {entry && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              ban.mutate(entry)
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle className="break-words">
                Banna ”{entry.name}”?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {entry.device
                  ? `Enheten ${shortId(entry.device)} kan inte spara längre. Dess ${entry.sameDevice} åk döljs.`
                  : "Gammalt åk utan enhet, så bara namnet kan bannas."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {entry.device && (
              <>
                <ToggleRow
                  id="ban-fingerprint"
                  label="Även fingeravtrycket"
                  hint={BAN_LABELS.fingerprint.hint}
                  checked={fingerprint}
                  disabled={!entry.fingerprint}
                  onChange={setFingerprint}
                />
                <ToggleRow
                  id="ban-ip"
                  label={`Även IP-adressen${entry.ip ? ` (${entry.ip})` : ""}`}
                  hint={BAN_LABELS.ip.hint}
                  checked={ip}
                  disabled={!entry.ip}
                  onChange={setIp}
                />
              </>
            )}
            <BanTermsFields terms={terms} onChange={setTerms} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Avbryt</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={ban.isPending}
              >
                <ProhibitIcon data-icon="inline-start" />
                Banna
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  )
}

/** A badge that explains itself on hover. */
function HintBadge({
  label,
  hint,
  variant,
}: {
  label: string
  hint: string
  variant: "secondary" | "destructive" | "outline"
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant={variant} tabIndex={0} />}>
        {label}
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

function ScoreRow({
  entry,
  filtered,
  onModerate,
  onDevice,
  onBan,
  onRemove,
}: {
  entry: AdminScoreEntry
  /** Already showing only this device's runs. */
  filtered: boolean
  onModerate: (action: "approve" | "hide" | "show") => void
  onDevice: () => void
  onBan: () => void
  /** `all`: every run with this name. */
  onRemove: (all: boolean) => void
}) {
  const top = isOnLeaderboard(entry.rank)
  const status = STATUS_BADGES[entry.status]
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center text-xs font-semibold tabular-nums",
          top ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        )}
        title={
          entry.rank === null
            ? "Räknas inte på topplistan"
            : `Plats ${entry.rank}`
        }
      >
        {entry.rank ?? "–"}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "truncate text-sm font-medium",
              (entry.status === "hidden" || entry.status === "shadow") &&
                "text-muted-foreground line-through"
            )}
          >
            {entry.name}
          </span>
          {top && (
            <Badge title="Syns på topplistan">
              <TrophyIcon data-icon="inline-start" />
              <span className="sr-only sm:not-sr-only">Topplistan</span>
            </Badge>
          )}
          {status && <HintBadge variant="secondary" {...status} />}
          {entry.old && (
            <HintBadge
              variant="outline"
              label="Före nollställning"
              hint="Räknas inte längre."
            />
          )}
          {entry.flags.map((f) => (
            <HintBadge
              key={f}
              variant={
                f === "unverified" || f === "nomac" ? "outline" : "destructive"
              }
              {...FLAG_LABELS[f]}
            />
          ))}
        </span>
        <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground tabular-nums sm:text-xs">
          <span>
            {num(entry.cans)} {entry.cans === 1 ? "flaska" : "flaskor"}
          </span>
          <span>{num(entry.distance)} m</span>
          {entry.seconds !== null && <span>{num(entry.seconds)} s</span>}
          <time dateTime={entry.at}>{formatShort(new Date(entry.at))}</time>
          {entry.sameName > 1 && (
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3" />
              {entry.sameName} med namnet
            </span>
          )}
          {entry.device && (
            <button
              type="button"
              disabled={filtered}
              onClick={onDevice}
              title={filtered ? undefined : "Visa åk från den här enheten"}
              className="flex items-center gap-1 enabled:cursor-pointer enabled:hover:text-foreground enabled:hover:underline"
            >
              <DesktopIcon className="size-3" />
              {shortId(entry.device)}
              {entry.sameDevice > 1 && ` · ${entry.sameDevice} åk`}
            </button>
          )}
        </span>
      </div>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold tabular-nums">
          {num(entry.score)}
        </span>
        <span className="block text-[11px] text-muted-foreground">poäng</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              className="-mr-2 shrink-0"
              aria-label={`Hantera ${entry.name}`}
            />
          }
        >
          <DotsThreeVerticalIcon weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          {entry.status === "held" && (
            <DropdownMenuItem onClick={() => onModerate("approve")}>
              <CheckIcon />
              Godkänn
            </DropdownMenuItem>
          )}
          {entry.status === "hidden" || entry.status === "shadow" ? (
            <DropdownMenuItem onClick={() => onModerate("show")}>
              <EyeIcon />
              Visa igen
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onModerate("hide")}>
              <EyeSlashIcon />
              Dölj
            </DropdownMenuItem>
          )}
          {entry.device && entry.sameDevice > 1 && !filtered && (
            <DropdownMenuItem onClick={onDevice}>
              <DesktopIcon />
              Visa alla {entry.sameDevice} åk från enheten
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onBan}>
            <ProhibitIcon />
            {entry.device ? "Banna spelaren…" : "Banna namnet…"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onRemove(false)}
          >
            <TrashIcon />
            Ta bort det här åket
          </DropdownMenuItem>
          {entry.sameName > 1 && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onRemove(true)}
            >
              <UsersIcon />
              Ta bort alla {entry.sameName} åk med namnet
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
