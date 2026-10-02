import type { BanKind, GameFlag } from "./constants"
import { TICK_RATE } from "./puckopist"

/*
 * How Puckopist keeps the leaderboard honest. Anything in the browser can be
 * changed by a determined player, so the server never takes a score from it:
 *
 * 1. Before a run, the server hands out a single-use ticket with the seed of
 *    the piste and a key. The run can only be saved once, from the same
 *    device, so replaying a request does nothing.
 * 2. While riding, the game records when jump is pressed and let go, and
 *    keeps a running digest of the skier's state.
 * 3. After the crash, the browser sends the presses, the digest and an
 *    HMAC-SHA256 over them made with the ticket's key. The server replays
 *    the presses on the same piste and takes its own score. Editing the score
 *    in a proxy, or the game's state in the console, gives a run that doesn't
 *    match its replay and gets flagged. A run that's finished faster than it
 *    could be played is refused.
 * 4. Signs of tampering in the browser (developer tools open, timers swapped
 *    out, slow motion) flag the run, and flagged runs can wait for an admin
 *    before they show up.
 */

/** Flags that hold a run for review (when that's switched on). */
export const HOLD_FLAGS: readonly GameFlag[] = [
  "devtools",
  "hooked",
  "slow",
  "mismatch",
]

/** Flags the browser reports about itself; the rest are the server's. */
export const CLIENT_FLAGS = ["devtools", "hooked"] as const satisfies GameFlag[]

export const FLAG_LABELS: Record<GameFlag, { label: string; hint: string }> = {
  devtools: {
    label: "DevTools",
    hint: "DevTools var öppna.",
  },
  hooked: {
    label: "Manipulerad",
    hint: "Spelets klocka var utbytt.",
  },
  slow: {
    label: "Långsam",
    hint: "Tog mycket längre tid än i spelet.",
  },
  mismatch: {
    label: "Stämmer inte",
    hint: "Stämde inte med serverns uppspelning. Poängen är serverns.",
  },
  nomac: {
    label: "Ingen checksumma",
    hint: "Ingen checksumma skickades.",
  },
  unverified: {
    label: "Overifierad",
    hint: "Från före kontrollen, poängen är okollad.",
  },
}

export function shouldHold(flags: readonly GameFlag[]) {
  return flags.some((f) => HOLD_FLAGS.includes(f))
}

/**
 * Checks a run's length in the game against how long it took in reality.
 * The game can't run faster than real time (it only slows down when frames
 * are slow), so anything much quicker is made up. Much slower is slow motion,
 * or the tab was in the background.
 */
export function checkTiming(ticks: number, elapsedMs: number) {
  const game = ticks / TICK_RATE
  const real = elapsedMs / 1000
  // Some slack for the network on either end.
  if (real < game * 0.97 - 3) return "fast" as const
  if (real > game * 1.5 + 20) return "slow" as const
  return "ok" as const
}

/** What a run's HMAC is made over, the same in the browser and on the server. */
export function macMessage(r: {
  runId: string
  ticks: number
  digest: number
  score: number
  cans: number
  distance: number
  inputs: number[]
}) {
  return [
    "puckopist-v1",
    r.runId,
    r.ticks,
    r.digest,
    r.score,
    r.cans,
    r.distance,
    r.inputs.join(","),
  ].join("|")
}

/** How long a ticket can wait before its run starts. */
export const TICKET_TTL_MS = 60 * 60 * 1000
/** How long after the crash a run can still be saved. */
export const SAVE_TTL_MS = 60 * 60 * 1000

export const BAN_LABELS: Record<BanKind, { label: string; hint: string }> = {
  device: {
    label: "Enhet",
    hint: "Webbläsarens cookie.",
  },
  fingerprint: {
    label: "Fingeravtryck",
    hint: "Klarar rensade cookies, men kan träffa likadana datorer.",
  },
  ip: {
    label: "IP-adress",
    hint: "Träffar alla på samma wifi.",
  },
  name: {
    label: "Namn",
    hint: "Namn som innehåller texten.",
  },
}
