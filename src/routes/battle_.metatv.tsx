import funFont from "@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2?url"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { DressedBottle, type Sticker } from "@/components/battle/dressed-bottle"
import { SIDE_BAR } from "@/components/battle/side-styles"
import { battleQuery } from "@/lib/battle/queries"
import { jaegerShare, leader, type Side } from "@/lib/battle/types"
import { useBattleStream } from "@/lib/battle/use-battle-stream"

/**
 * Marketing slide for the TV in META: Jäger vs Minttu shots, with the live
 * score along the bottom. 16:9, no chrome. Not behind the battle feature
 * switch, so it can go up before the battle starts.
 */
export const Route = createFileRoute("/battle_/metatv")({
  staticData: { siteHeader: false, toasts: false },
  head: () => ({
    meta: [{ title: "Shots 40 kr · Jäger vs Minttu · dÅre 27" }],
    links: [
      { rel: "preload", href: "/battle/are.webp", as: "image" },
      { rel: "preload", href: "/battle/bottle-jaeger.webp", as: "image" },
      { rel: "preload", href: "/battle/bottle-minttu.webp", as: "image" },
      ...Object.values(GLITTER).map((href) => ({
        rel: "preload",
        href,
        as: "image",
      })),
      ...Object.values(CROWNS).map((c) => ({
        rel: "preload",
        href: c.src,
        as: "image",
      })),
      {
        rel: "preload",
        href: funFont,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(battleQuery),
  component: MetaTvSlide,
})

const JAEGER = "#f26a1b"
const MINTTU = "#1747c9"

const BOTTLES = {
  jaeger: { src: "/battle/bottle-jaeger.webp", width: 800, height: 1985 },
  minttu: { src: "/battle/bottle-minttu.webp", width: 800, height: 2206 },
}
const CROWN_DROP = "animate-[metatv-crown-drop_.7s_cubic-bezier(.3,.7,.3,1)]"
/**
 * Whoever leads wears their crown (both do on a tie), placed in the bottle
 * photo's own pixels with the bottom band sitting down over the cap.
 */
const CROWNS: Record<Side, Sticker> = {
  jaeger: {
    src: "/battle/stickers/crown-india.webp",
    x: 185,
    y: -399,
    width: 426,
    className: CROWN_DROP,
  },
  minttu: {
    src: "/battle/stickers/crown-finland.webp",
    x: 193,
    y: -364,
    width: 412,
    className: CROWN_DROP,
  },
}

/** CC0 silver glitter photos (Michelle Grewe), torn into scraps. */
const GLITTER = {
  strip: "/battle/stickers/glitter-strip.webp",
  scrapA: "/battle/stickers/glitter-scrap-a.webp",
  scrapB: "/battle/stickers/glitter-scrap-b.webp",
}

type Placed = {
  side: Side
  alt: string
  /** The two big ones, which can wear the crown. */
  star?: boolean
  className: string
}

// Back to front: the small extras first, the two stars last.
const PLACED: Placed[] = [
  {
    side: "jaeger",
    alt: "",
    className: "top-[34%] left-[36%] h-[min(26vh,15vw)] rotate-[24deg]",
  },
  {
    side: "minttu",
    alt: "",
    className: "top-[76%] left-[64%] h-[min(26vh,15vw)] rotate-[-22deg]",
  },
  {
    side: "jaeger",
    alt: "Jägermeister",
    star: true,
    className: "top-[60%] left-[15%] h-[min(54vh,31vw)] -rotate-[9deg]",
  },
  {
    side: "minttu",
    alt: "Minttu",
    star: true,
    className: "top-[59%] left-[85%] h-[min(54vh,31vw)] rotate-[8deg]",
  },
]

const FUN = "font-['Lilita_One',sans-serif] font-normal"
/** A plain hard drop shadow, like the default one in a slideshow program. */
const CHEAP_SHADOW = "[text-shadow:.06em_.07em_0_#000]"
// Each name in a face like its own label, tinted light brown and light blue.
const JAEGER_NAME =
  "font-['Grenze_Gotisch',serif] font-bold text-[10vh] text-[#dcbb94]"
const MINTTU_NAME =
  "font-['Archivo_Black',sans-serif] text-[7vh] uppercase text-[#b4dcff]"

function MetaTvSlide() {
  // The stream keeps it live; the refetch catches anything it missed.
  const { data } = useSuspenseQuery({ ...battleQuery, refetchInterval: 15_000 })
  useBattleStream()
  const share = jaegerShare(data)
  const lead = leader(data)

  return (
    <div className="fixed inset-0 flex cursor-none flex-col overflow-hidden bg-[#0c0c14] font-['Instrument_Sans',sans-serif] text-white select-none">
      <div className="relative flex-1 overflow-hidden">
        <img
          src="/battle/are.webp"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        {/* Corner to corner: Jäger top left, Minttu bottom right. */}
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{
            background: `linear-gradient(to bottom right, ${JAEGER} 50%, ${MINTTU} 50%)`,
          }}
        />

        {PLACED.map((p) => (
          <DressedBottle
            key={p.className}
            {...BOTTLES[p.side]}
            alt={p.alt}
            stickers={
              p.star && (lead === p.side || lead === null)
                ? [CROWNS[p.side]]
                : []
            }
            className={`absolute -translate-1/2 ${p.className}`}
          />
        ))}

        {/* Scraps of glitter tape, slapped on by hand. */}
        <img
          src={GLITTER.scrapA}
          alt=""
          className="absolute top-1/2 left-1/2 w-[34vh] -translate-x-[54%] -translate-y-[46%] rotate-[-9deg]"
        />
        <img
          src={GLITTER.scrapB}
          alt=""
          className="absolute top-[6.5vh] left-[15.5%] w-[13vh] rotate-[-13deg]"
        />

        <h1
          className={`absolute top-[4vh] left-1/2 -translate-x-1/2 -rotate-2 text-[9vh] leading-none whitespace-nowrap ${CHEAP_SHADOW} ${FUN}`}
        >
          Vilken är den bästa shotten?!?
        </h1>

        <div
          className={`absolute top-1/2 left-1/2 -translate-1/2 rotate-[-6deg] text-[16vh] leading-[.85] whitespace-nowrap ${CHEAP_SHADOW} ${FUN}`}
        >
          40<span className="ml-[1.2vh] text-[7vh]">kr</span>
        </div>
      </div>

      {/* Two crooked strips of glitter tape over the seam, overlapping. */}
      <div aria-hidden className="relative z-10 h-0">
        <img
          src={GLITTER.strip}
          alt=""
          className="absolute -top-[2.4vh] -left-[2vw] h-[5vh] w-[62vw] max-w-none rotate-[-1.4deg]"
        />
        <img
          src={GLITTER.strip}
          alt=""
          className="absolute -top-[2.1vh] -right-[3vw] h-[4.4vh] w-[50vw] max-w-none -scale-x-100 rotate-[0.9deg]"
        />
      </div>

      {/* Live score. */}
      <div className="grid h-[24vh] grid-cols-[auto_1fr_auto] items-center gap-[3vw] px-[4vw]">
        <Score
          side="jaeger"
          name="Jäger"
          nameClass={JAEGER_NAME}
          count={data.jaeger}
          lead={lead}
        />
        <div className="flex h-[3.5vh]">
          <div
            className={`transition-[flex-grow] duration-500 ease-out ${SIDE_BAR.jaeger}`}
            style={{ flexGrow: share }}
          />
          <div
            className={`transition-[flex-grow] duration-500 ease-out ${SIDE_BAR.minttu}`}
            style={{ flexGrow: 1 - share }}
          />
        </div>
        <Score
          side="minttu"
          name="Minttu"
          nameClass={MINTTU_NAME}
          count={data.minttu}
          lead={lead}
          right
        />
      </div>
    </div>
  )
}

function Score({
  side,
  name,
  nameClass,
  count,
  lead,
  right = false,
}: {
  side: Side
  name: string
  nameClass: string
  count: number
  lead: Side | null
  right?: boolean
}) {
  // The leader's number wears its crown; the other one fades back.
  const leading = lead === side
  return (
    <div
      className={`flex items-center gap-[1.6vw] ${right ? "flex-row-reverse" : ""}`}
    >
      <span className={`leading-none ${nameClass}`}>{name}</span>
      <span
        className={`relative transition-opacity duration-500 ${lead && !leading ? "opacity-45" : ""}`}
      >
        {leading && (
          <span className="absolute inset-x-0 bottom-[82%] flex justify-center">
            <img
              src={CROWNS[side].src}
              alt="Leder"
              className={`h-[8vh] w-auto ${CROWN_DROP}`}
              style={{ rotate: right ? "10deg" : "-10deg" }}
            />
          </span>
        )}
        {/* Keyed on the value, so every change replays the bump. */}
        <span
          key={count}
          className={`inline-block min-w-[2ch] animate-[battle-bump_.5s_cubic-bezier(.2,.8,.2,1)] text-center text-[15vh] leading-none ${FUN}`}
        >
          {count}
        </span>
      </span>
    </div>
  )
}
