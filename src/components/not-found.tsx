import { Link } from "@tanstack/react-router"
import { Snow } from "@/components/landing/snow"

/** 404, in the landing page's night sky: you've skied off-piste. */
export function NotFound() {
  return (
    <main className="relative flex h-svh flex-col overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#13204a_0%,#050818_70%)] font-['Instrument_Sans',sans-serif] text-white">
      <title>Utanför pisten · dÅre 27</title>
      <Snow className="pointer-events-none absolute inset-0" />

      <header className="relative px-[clamp(18px,3vw,44px)] py-[clamp(14px,2vw,26px)]">
        <Link to="/" className="inline-flex">
          <img
            src="/dare27-logo-white.png"
            alt="dÅre 2027"
            width={800}
            height={413}
            className="block h-[clamp(44px,5vw,64px)] w-auto"
          />
        </Link>
      </header>

      <section className="relative flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-[8svh] text-center">
        <div className="flex items-center gap-4 font-['IBM_Plex_Mono',monospace] text-xs tracking-[.34em] text-[#eef5ff] uppercase">
          <span className="h-px w-10 bg-white/70" />
          Utanför pisten
          <span className="h-px w-10 bg-white/70" />
        </div>
        {/* A black-run marker (double diamond) for the scariest slope. */}
        <div className="flex items-center gap-[clamp(14px,2.4vw,32px)]">
          <span
            aria-hidden
            className="size-[clamp(22px,3vw,40px)] rotate-45 bg-white"
          />
          <h1 className="font-['Big_Shoulders_Display',sans-serif] text-[clamp(120px,22vw,300px)] leading-[.8] font-black tracking-tight">
            404
          </h1>
          <span
            aria-hidden
            className="size-[clamp(22px,3vw,40px)] rotate-45 bg-white"
          />
        </div>
        <p className="max-w-md text-[clamp(16px,1.5vw,19px)] text-[#d6e2ff]">
          Den här sidan finns inte, eller så har den flyttats. Vänd om innan du
          hamnar i skogen.
        </p>
        <Link
          to="/"
          className="mt-2 rounded-full bg-white px-7 py-3 text-[17px] font-semibold text-[#0b1233] no-underline transition-transform duration-200 hover:-translate-y-0.5"
        >
          Tillbaka till toppen
        </Link>
      </section>
    </main>
  )
}
