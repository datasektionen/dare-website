import digitFont from "@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff2?url"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Countdown } from "@/components/landing/countdown"
import { Snow } from "@/components/landing/snow"
import { BIG_QR, TicketQr } from "@/components/landing/ticket-qr"
import {
  LIVE_MS,
  ticketLinkQuery,
  ticketReleaseQuery,
} from "@/lib/ticket-release/queries"
import { formatRelease } from "@/lib/time"

/**
 * The ticket link as one big QR code, for a screen at the release. Counts
 * down until then and switches over by itself; the link itself only comes
 * from the server once the release time has passed.
 */
export const Route = createFileRoute("/qr")({
  staticData: { siteHeader: false, toasts: false },
  head: () => ({
    meta: [{ title: "Biljetter · dÅre 27" }],
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
  loader: async ({ context }) => {
    const release =
      await context.queryClient.ensureQueryData(ticketReleaseQuery)
    if (Date.now() >= new Date(release.at).getTime())
      await context.queryClient.ensureQueryData(ticketLinkQuery)
  },
  component: QrPage,
})

function QrPage() {
  // Re-checked, in case an admin moves the release time or releases now.
  const { data } = useSuspenseQuery({
    ...ticketReleaseQuery,
    refetchInterval: LIVE_MS,
  })
  const release = useMemo(() => new Date(data.at), [data.at])
  const [released, setReleased] = useState(
    () => Date.now() >= release.getTime()
  )
  const onZero = useCallback(() => setReleased(true), [])
  const { data: link } = useQuery({ ...ticketLinkQuery, enabled: released })

  useEffect(() => {
    setReleased(Date.now() >= release.getTime())
  }, [release])

  return (
    <main className="relative flex h-svh flex-col items-center justify-center gap-[2.5vh] overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#13204a_0%,#050818_70%)] px-5 py-[3svh] text-center font-['Instrument_Sans',sans-serif] text-white">
      <Snow className="pointer-events-none absolute inset-0" />
      <img
        src="/dare27-logo-white.png"
        alt="dÅre 2027"
        width={800}
        height={413}
        className="relative h-[clamp(40px,7vh,88px)] w-auto"
      />

      {!released ? (
        <div className="relative flex flex-col items-center gap-[2.5vh]">
          <Kicker>Biljettsläppet om</Kicker>
          <Countdown target={release} lang="sv" onZero={onZero} />
          <p className="text-[clamp(15px,1.6vw,22px)] font-medium text-[#f4f8ff]">
            {formatRelease(release, "sv")}
          </p>
        </div>
      ) : link?.state === "open" ? (
        <div className="relative flex flex-col items-center gap-[2vh]">
          <TicketQr
            url={link.url}
            caption="QR-kod till biljettköpet"
            className={BIG_QR}
          />
          {/* For anyone who can't scan: the site has the big buy button. */}
          <p className="text-[clamp(15px,2.2vh,24px)] text-white/80">
            eller gå in på{" "}
            <span className="font-semibold text-white">
              dåre.datasektionen.se
            </span>
          </p>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-4">
          <Kicker>Biljetterna är släppta</Kicker>
          <p className="font-['Big_Shoulders_Display',sans-serif] text-[clamp(48px,9vw,120px)] leading-none font-black">
            {link?.state === "missing" ? "Länken kommer strax" : "Släpps nu …"}
          </p>
        </div>
      )}
    </main>
  )
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 font-['IBM_Plex_Mono',monospace] text-[clamp(11px,1.2vw,15px)] tracking-[.34em] text-[#eef5ff] uppercase">
      <span className="h-px w-10 bg-white/70" />
      {children}
      <span className="h-px w-10 bg-white/70" />
    </div>
  )
}
