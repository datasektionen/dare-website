import {
  DotsThreeVerticalIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { activityQuery } from "@/lib/activity/queries"
import {
  type AdminScoreEntry,
  isOnLeaderboard,
  PAGE_SIZE,
} from "@/lib/game/admin"
import { removeScores } from "@/lib/game/functions"
import { LEADERBOARD_SIZE } from "@/lib/game/leaderboard"
import { leaderboardQuery, scoresQuery } from "@/lib/game/queries"
import { formatShort } from "@/lib/time"
import { cn } from "@/lib/utils"

const num = (n: number) => n.toLocaleString("sv-SE")

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

/** Every saved Puckopist run, searchable, with buttons to remove them. */
export function GameScores() {
  const [search, setSearch] = useState("")
  const q = useDebounced(search.trim(), 250)
  // "Visa fler" pages through one search; a new search starts from the top.
  const [more, setMore] = useState({ q, limit: PAGE_SIZE })
  const limit = more.q === q ? more.limit : PAGE_SIZE
  // Kept after closing, so the dialog doesn't go blank while it fades out.
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const { data, isPlaceholderData } = useQuery({
    ...scoresQuery(q, limit),
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
    onError: (error) =>
      toast.error("Kunde inte ta bort", {
        description: error instanceof Error ? error.message : undefined,
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["game", "scores"] }),
        queryClient.invalidateQueries({ queryKey: leaderboardQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: activityQuery.queryKey }),
      ]),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alla åk</CardTitle>
        <CardDescription>
          {data
            ? `${num(data.total)} sparade åk, bäst först. `
            : "Sparade åk, bäst först. "}
          De {LEADERBOARD_SIZE} bästa syns på topplistan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative">
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

        {!data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data.entries.length ? (
          <p className="well px-3 py-8 text-center text-xs text-muted-foreground">
            {q ? `Inga namn innehåller ”${q}”.` : "Ingen har sparat ett åk än."}
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
              onClick={() => setMore({ q, limit: limit + PAGE_SIZE })}
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
                    : `Åket med ${num(removal.entry.score)} poäng på plats ${removal.entry.rank} tas bort.`}{" "}
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
    </Card>
  )
}

function ScoreRow({
  entry,
  onRemove,
}: {
  entry: AdminScoreEntry
  /** `all`: every run with this name. */
  onRemove: (all: boolean) => void
}) {
  const top = isOnLeaderboard(entry.rank)
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center text-xs font-semibold tabular-nums",
          top ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        )}
        title={`Plats ${entry.rank}`}
      >
        {entry.rank}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{entry.name}</span>
          {top && (
            <Badge title="Syns på topplistan">
              <TrophyIcon data-icon="inline-start" />
              <span className="sr-only sm:not-sr-only">Topplistan</span>
            </Badge>
          )}
        </span>
        <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground tabular-nums sm:text-xs">
          <span>
            {num(entry.cans)} {entry.cans === 1 ? "burk" : "burkar"}
          </span>
          <span>{num(entry.distance)} m</span>
          <time dateTime={entry.at}>{formatShort(new Date(entry.at))}</time>
          {entry.sameName > 1 && (
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3" />
              {entry.sameName} åk med namnet
            </span>
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
              aria-label={`Ta bort ${entry.name}`}
            />
          }
        >
          <DotsThreeVerticalIcon weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
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
