import digitFont from "@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2?url"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Countdown, type Lang } from "@/components/landing/countdown"
import { LandingNav } from "@/components/landing/landing-nav"
import { Scene } from "@/components/landing/scene"
import { Snow } from "@/components/landing/snow"
import { TicketButton } from "@/components/landing/ticket-button"
import { ticketReleaseQuery } from "@/lib/ticket-release/queries"
import { formatRelease } from "@/lib/time"

const SNOW_DENSITY = 1

const T = {
  sv: {
    kicker: "Biljettsläppet om",
    out: "Biljetterna är släppta",
    buy: "Köp biljett",
  },
  en: {
    kicker: "Tickets release in",
    out: "Tickets are out",
    buy: "Get your ticket",
  },
} satisfies Record<Lang, Record<string, string>>

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "dÅre 27" }],
    // The countdown digits are the largest thing on the page.
    links: [
      {
        rel: "preload",
        href: digitFont,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  // The release time is set by admins on the dashboard.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(ticketReleaseQuery),
  component: Landing,
})

function Landing() {
  const [lang, setLang] = useState<Lang>("sv")
  const { data } = useSuspenseQuery(ticketReleaseQuery)
  const release = useMemo(() => new Date(data.at), [data.at])
  const [released, setReleased] = useState(
    () => Date.now() >= release.getTime()
  )
  const ctaRef = useRef<HTMLDivElement>(null)
  const wasReleased = useRef(released)
  const L = T[lang]

  const onZero = useCallback(() => setReleased(true), [])

  // If the time is moved, count down again.
  useEffect(() => {
    setReleased(Date.now() >= release.getTime())
  }, [release])

  // Pop the ticket button in when the countdown reaches zero.
  useEffect(() => {
    if (released && !wasReleased.current)
      ctaRef.current?.animate(
        [
          { opacity: 0, transform: "translateY(18px) scale(.94)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 800, easing: "cubic-bezier(.2,.8,.2,1)" }
      )
    wasReleased.current = released
  }, [released])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <div
      lang={lang}
      className="relative min-h-screen overflow-x-hidden bg-[#050818] font-['Instrument_Sans',sans-serif] text-white selection:bg-[#e83d84] selection:text-white"
    >
      <Scene className="fixed inset-0 z-0" />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_60%_48%_at_50%_42%,rgba(8,14,40,.5)_0%,rgba(8,14,40,0)_72%),linear-gradient(180deg,rgba(5,8,24,.35)_0%,rgba(5,8,24,0)_18%)]" />
      <Snow
        density={SNOW_DENSITY}
        className="pointer-events-none fixed inset-0 z-[3]"
      />
      <LandingNav
        lang={lang}
        onLang={setLang}
        className="fixed inset-x-0 top-0 z-10"
      />

      <section className="relative z-[2] box-border flex h-screen min-h-[640px] flex-col items-center justify-center gap-[clamp(18px,3vh,34px)] px-5 pt-[90px] pb-[22vh] text-center">
        <div className="flex items-center gap-4 font-['IBM_Plex_Mono',monospace] text-[clamp(11px,1.1vw,14px)] tracking-[.34em] text-[#eef5ff] uppercase [text-shadow:0_2px_16px_rgba(5,10,35,.6)]">
          <span className="h-px w-10 bg-white/70" />
          <span className="whitespace-nowrap">
            {released ? L.out : L.kicker}
          </span>
          <span className="h-px w-10 bg-white/70" />
        </div>
        <Countdown target={release} lang={lang} onZero={onZero} />
        <div className="text-[clamp(15px,1.4vw,19px)] font-medium text-[#f4f8ff] [text-shadow:0_2px_14px_rgba(5,10,35,.65)]">
          {formatRelease(release, lang)}
        </div>
        <div
          ref={ctaRef}
          className="flex min-h-[60px] flex-wrap items-center justify-center gap-3"
        >
          {released && <TicketButton label={L.buy} href="#biljett" />}
        </div>
      </section>
    </div>
  )
}
