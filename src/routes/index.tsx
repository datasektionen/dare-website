import digitFont from "@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2?url"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { z } from "zod"
import { Countdown, type Lang } from "@/components/landing/countdown"
import { LandingNav } from "@/components/landing/landing-nav"
import { Scene } from "@/components/landing/scene"
import { Snow } from "@/components/landing/snow"
import { TicketButton } from "@/components/landing/ticket-button"
import { BIG_QR, TicketQr } from "@/components/landing/ticket-qr"
import { featuresQuery } from "@/lib/settings/queries"
import {
  LIVE_MS,
  ticketLinkQuery,
  ticketReleaseQuery,
} from "@/lib/ticket-release/queries"
import { formatRelease } from "@/lib/time"

const SNOW_DENSITY = 1

const T = {
  sv: {
    kicker: "Biljettsläppet om",
    out: "Biljetterna är släppta",
    buy: "Köp biljett",
    scan: "QR-kod till biljettköpet",
    soon: "Biljettlänken kommer alldeles strax",
  },
  en: {
    kicker: "Tickets release in",
    out: "Tickets are out",
    buy: "Get your ticket",
    scan: "QR code for buying a ticket",
    soon: "The ticket link is coming right up",
  },
} satisfies Record<Lang, Record<string, string>>

export const Route = createFileRoute("/")({
  staticData: { siteHeader: false, toasts: false },
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
  // `?qr` swaps the buy button for a big QR code, e.g. on a screen.
  validateSearch: z.object({ qr: z.unknown().optional() }),
  // The release time is set by admins on the dashboard. Once it has passed,
  // fetch the ticket link too, so it's there from the first render.
  loader: async ({ context }) => {
    const [release] = await Promise.all([
      context.queryClient.ensureQueryData(ticketReleaseQuery),
      context.queryClient.ensureQueryData(featuresQuery),
    ])
    if (Date.now() >= new Date(release.at).getTime())
      await context.queryClient.ensureQueryData(ticketLinkQuery)
  },
  component: Landing,
})

function Landing() {
  const [lang, setLang] = useState<Lang>("sv")
  // Re-checked, in case an admin moves the release time or releases now.
  const { data } = useSuspenseQuery({
    ...ticketReleaseQuery,
    refetchInterval: LIVE_MS,
  })
  // Switched off in the dashboard once tickets are out: hide the numbers.
  const showCountdown = useSuspenseQuery(featuresQuery).data.ticketRelease
  const release = useMemo(() => new Date(data.at), [data.at])
  const [released, setReleased] = useState(
    () => Date.now() >= release.getTime()
  )
  const showQr = Route.useSearch({ select: (s) => s.qr !== undefined })
  // Only asked for once released; the server holds it back until then.
  const { data: link } = useQuery({ ...ticketLinkQuery, enabled: released })
  const ctaRef = useRef<HTMLDivElement>(null)
  const wasReleased = useRef(released)
  const L = T[lang]

  const onZero = useCallback(() => setReleased(true), [])

  // If the time is moved, count down again. Without the countdown (which
  // calls onZero), flip to "released" on time with a timer instead.
  useEffect(() => {
    const ms = release.getTime() - Date.now()
    setReleased(ms <= 0)
    if (showCountdown || ms <= 0 || ms > 2 ** 31 - 1) return
    const t = setTimeout(() => setReleased(true), ms)
    return () => clearTimeout(t)
  }, [release, showCountdown])

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
      className="relative h-svh overflow-hidden bg-[#050818] font-['Instrument_Sans',sans-serif] text-white selection:bg-[#e83d84] selection:text-white"
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

      {showQr && released && link?.state === "open" ? (
        // On a screen with `?qr`: nothing but the code, as big as on /qr.
        <section className="relative z-[2] flex h-svh items-center justify-center px-5 pt-[90px] pb-[3svh]">
          <TicketQr url={link.url} caption={L.scan} className={BIG_QR} />
        </section>
      ) : (
        <section className="relative z-[2] box-border flex h-svh flex-col items-center justify-center gap-[clamp(14px,3svh,34px)] px-5 pt-[clamp(64px,11svh,90px)] pb-[min(22svh,180px)] text-center">
          <div className="flex items-center gap-4 font-['IBM_Plex_Mono',monospace] text-[clamp(11px,1.1vw,14px)] tracking-[.34em] text-[#eef5ff] uppercase [text-shadow:0_2px_16px_rgba(5,10,35,.6)]">
            <span className="h-px w-10 bg-white/70" />
            <span className="whitespace-nowrap">
              {released ? L.out : L.kicker}
            </span>
            <span className="h-px w-10 bg-white/70" />
          </div>
          {showCountdown && (
            <Countdown target={release} lang={lang} onZero={onZero} />
          )}
          <div className="text-[clamp(15px,1.4vw,19px)] font-medium text-[#f4f8ff] [text-shadow:0_2px_14px_rgba(5,10,35,.65)]">
            {formatRelease(release, lang)}
          </div>
          <div
            ref={ctaRef}
            className="flex min-h-[60px] flex-wrap items-center justify-center gap-3"
          >
            {released && link?.state === "open" ? (
              <TicketButton label={L.buy} href={link.url} />
            ) : released && link?.state === "missing" ? (
              <p className="text-[clamp(15px,1.4vw,19px)] text-[#d6e2ff] [text-shadow:0_2px_14px_rgba(5,10,35,.65)]">
                {L.soon}
              </p>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
