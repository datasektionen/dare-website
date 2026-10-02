import type { Lang } from "@/components/landing/countdown"

export const T = {
  sv: {
    presents: "dÅre presenterar",
    tagline: "Samla Pucko-burkar, gör trix och undvik hinder.",
    jump: "Tryck eller mellanslag för att hoppa",
    flip: "Håll inne i luften för att göra volt",
    jumpTouch: "Tryck på skärmen för att hoppa",
    flipTouch: "Håll kvar fingret i luften för att göra volt",
    land: "Landa med skidorna mot backen",
    start: "Åk!",
    again: "Åk igen",
    orSpace: "eller tryck mellanslag",
    crash: "Vurpa!",
    score: "Poäng",
    cans: "Burkar",
    metres: "Meter",
    best: "Rekord",
    newBest: "Nytt rekord!",
    flips: ["", "Volt!", "Dubbelvolt!", "Trippelvolt!"],
    manyFlips: (n: number) => `${n}× volt!`,
    perfect: "Perfekt landning",
    bigAir: "Stor luft!",
    leaderboard: "Topplista",
    back: "Tillbaka",
    empty: "Ingen har åkt än. Bli först!",
    saveTitle: "Spara på topplistan",
    name: "Ditt namn",
    save: "Spara",
    saving: "Sparar…",
    saved: (rank: number) => `Sparat! Du kom på plats ${rank}.`,
    saveFailed: "Kunde inte spara. Försök igen om en stund.",
    remove: (name: string) => `Ta bort ${name} från topplistan`,
  },
  en: {
    presents: "dÅre presents",
    tagline: "Collect Pucko cans, do tricks and dodge obstacles.",
    jump: "Tap or press space to jump",
    flip: "Hold in the air to backflip",
    jumpTouch: "Tap the screen to jump",
    flipTouch: "Keep your finger down in the air to backflip",
    land: "Land with your skis on the slope",
    start: "Ride!",
    again: "Ride again",
    orSpace: "or press space",
    crash: "Wipeout!",
    score: "Score",
    cans: "Cans",
    metres: "Metres",
    best: "Best",
    newBest: "New best!",
    flips: ["", "Backflip!", "Double backflip!", "Triple backflip!"],
    manyFlips: (n: number) => `${n}× backflip!`,
    perfect: "Perfect landing",
    bigAir: "Big air!",
    leaderboard: "Leaderboard",
    back: "Back",
    empty: "Nobody has skied yet. Be the first!",
    saveTitle: "Save to the leaderboard",
    name: "Your name",
    save: "Save",
    saving: "Saving…",
    saved: (rank: number) => `Saved! You came in at number ${rank}.`,
    saveFailed: "Couldn't save. Try again in a moment.",
    remove: (name: string) => `Remove ${name} from the leaderboard`,
  },
} satisfies Record<Lang, unknown>

export type Texts = (typeof T)[Lang]

export const DISPLAY = "font-['Big_Shoulders_Display',sans-serif] font-black"
export const MONO = "font-['IBM_Plex_Mono',monospace] uppercase"
/** Icy letters, like the landing page's countdown digits. */
export const ICE =
  "bg-[linear-gradient(180deg,#ffffff_0%,#eef8ff_26%,#bfe0f8_50%,#f4fbff_57%,#7fb4e4_80%,#b9dcf6_100%)] bg-clip-text text-transparent [filter:drop-shadow(0_0_24px_rgba(150,205,255,.45))_drop-shadow(0_3px_10px_rgba(8,20,60,.45))]"
export const SHADOW = "[text-shadow:0_2px_14px_rgba(5,10,35,.65)]"
