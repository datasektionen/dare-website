import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useRef, useState } from "react"
import { removeScores } from "@/lib/game/admin-functions"
import { type Saved, submitScore } from "@/lib/game/functions"
import {
  cleanName,
  NAME_MAX,
  type RunResult,
  type ScoreEntry,
} from "@/lib/game/leaderboard"
import { leaderboardQuery } from "@/lib/game/queries"
import { cn } from "@/lib/utils"
import { DISPLAY, MONO, SHADOW, type Texts } from "./texts"

const NAME_KEY = "puckopist-name"

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? ""
  } catch {
    return ""
  }
}

function storeName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // Blocked storage: the name just isn't remembered.
  }
}

/** The best runs, with the player's own run marked (and added if below). */
export function Leaderboard({
  L,
  mine,
  admin,
  className,
}: {
  L: Texts
  /** The run the player just saved, if any. */
  mine: ScoreEntry | null
  /** Admins can remove runs, e.g. with rude names. */
  admin: boolean
  className?: string
}) {
  const { data } = useSuspenseQuery(leaderboardQuery)
  const queryClient = useQueryClient()
  const remove = useMutation({
    // Logged, like removals on the dashboard.
    mutationFn: (id: number) => removeScores({ data: { id } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["game"] }),
  })
  const below = mine && !data.some((r) => r.id === mine.id) ? mine : null

  return (
    <section
      className={cn(
        "w-full max-w-sm rounded-2xl border border-white/15 bg-[rgba(8,14,40,.6)] p-4 text-left backdrop-blur-md sm:p-5",
        className
      )}
    >
      <h2
        className={cn(
          MONO,
          "mb-3 text-xs font-medium tracking-[.32em]",
          SHADOW
        )}
      >
        {L.leaderboard}
      </h2>
      {data.length === 0 ? (
        <p className="py-4 text-center text-sm text-white/75">{L.empty}</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {data.map((r) => (
            <Row
              key={r.id}
              entry={r}
              mine={r.id === mine?.id}
              onRemove={admin ? () => remove.mutate(r.id) : undefined}
              L={L}
            />
          ))}
          {below && (
            <>
              <li
                aria-hidden
                className="text-center leading-none text-white/50"
              >
                ⋮
              </li>
              <Row entry={below} mine L={L} />
            </>
          )}
        </ol>
      )}
    </section>
  )
}

function Row({
  entry,
  mine,
  onRemove,
  L,
}: {
  entry: ScoreEntry
  mine: boolean
  onRemove?: () => void
  L: Texts
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[2.2em_1fr_auto] items-center gap-2 rounded-lg px-2 py-1",
        mine && "bg-[#e83d84]/25 ring-1 ring-[#e83d84]"
      )}
    >
      <span
        className={cn(
          MONO,
          "text-xs tabular-nums",
          entry.rank === 1 ? "text-[#ffc15a]" : "text-white/60"
        )}
      >
        {entry.rank}.
      </span>
      <span className="truncate text-[15px] font-medium">{entry.name}</span>
      <span className="flex items-center gap-2">
        <span className={cn(DISPLAY, "text-xl leading-none tabular-nums")}>
          {entry.score}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={L.remove(entry.name)}
            title={L.remove(entry.name)}
            className="flex size-6 cursor-pointer items-center justify-center rounded-full text-white/50 hover:bg-white/15 hover:text-white"
          >
            ×
          </button>
        )}
      </span>
    </li>
  )
}

/** Name field for saving a run to the leaderboard. */
export function SaveScore({
  runId,
  run,
  defaultName,
  onSaved,
  L,
}: {
  /** The checked run; null while the server is still checking it. */
  runId: string | null
  run: RunResult
  /** Used when no name has been saved on this device before. */
  defaultName: string
  /** `rank` is null when the run waits for an admin before it shows. */
  onSaved: (entry: Omit<ScoreEntry, "rank"> & { rank: number | null }) => void
  L: Texts
}) {
  const [name, setName] = useState(() => readName() || defaultName)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (name: string): Promise<Saved> => {
      if (!runId) throw new Error("Not checked yet")
      return submitScore({ data: { runId, name } })
    },
    onSuccess: ({ id, rank }, name) => {
      storeName(name)
      onSaved({ id, rank, name, ...run, at: new Date().toISOString() })
      queryClient.invalidateQueries({ queryKey: leaderboardQuery.queryKey })
    },
  })
  const clean = cleanName(name)

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!clean || !runId || save.isPending) return
        // Closes the keyboard on phones.
        inputRef.current?.blur()
        save.mutate(clean)
      }}
    >
      <label
        htmlFor="puckopist-name"
        className={cn(
          MONO,
          "text-[11px] tracking-[.2em] text-white/80",
          SHADOW
        )}
      >
        {L.saveTitle}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="puckopist-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={L.name}
          maxLength={NAME_MAX}
          autoComplete="nickname"
          enterKeyHint="send"
          // 16px, so iOS doesn't zoom in on focus.
          className="h-12 min-w-0 flex-1 rounded-full border border-white/25 bg-white/12 px-5 text-base text-white backdrop-blur-[10px] outline-none select-text placeholder:text-white/50 focus:border-white/70"
        />
        <button
          type="submit"
          disabled={!clean || !runId || save.isPending}
          className="h-12 shrink-0 cursor-pointer rounded-full bg-[#e83d84] px-6 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_8px_30px_rgba(232,61,132,.4)] transition-colors hover:bg-[#f0529a] disabled:cursor-default disabled:opacity-50"
        >
          {!runId ? L.checking : save.isPending ? L.saving : L.save}
        </button>
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-[#ffb3cf]">
          {/* The server's reason when it gave one, e.g. a closed leaderboard. */}
          {save.error instanceof Error && save.error.message.length < 80
            ? save.error.message
            : L.saveFailed}
        </p>
      )}
    </form>
  )
}
