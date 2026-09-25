import { Pines } from "./pines"

/*
 * Background for the whole dashboard: a sunny day in Åre. Blue sky and
 * snow-capped mountains at the top, a groomed slope below, and spruces at the
 * edges. Static SVG and CSS only.
 */
export function SlopeBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[linear-gradient(180deg,#bfe2ff_0px,#e2f2ff_180px,#f5f8fb_320px)]"
    >
      {/* Sun. */}
      <div className="absolute top-8 right-[12%] size-20 rounded-full bg-[#fff3c4] shadow-[0_0_0_18px_rgba(255,243,196,.35),0_0_80px_30px_rgba(255,230,150,.45)]" />
      {/* Mountains: a far range, then Åreskutan. */}
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 top-20 h-56 w-full"
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
      >
        <path
          d="M0 170 L110 110 L190 140 L300 80 L400 130 L520 95 L640 140 L760 90 L880 135 L1000 100 L1110 140 L1200 115 L1200 220 L0 220 Z"
          fill="#cfe0f2"
        />
        <path
          d="M300 80 L270 97 L292 94 L310 104 L322 92 Z M760 90 L735 104 L756 101 L772 110 L784 99 Z M520 95 L500 106 L518 104 L530 111 Z"
          fill="#ffffff"
        />
        <path
          d="M0 200 L180 150 L330 175 L560 60 L700 130 L820 112 L1000 165 L1200 150 L1200 220 L0 220 Z"
          fill="#e3edf8"
        />
        <path
          d="M560 60 L515 88 L545 84 L565 98 L590 82 L618 90 Z"
          fill="#ffffff"
        />
      </svg>
      {/* The slope: snow with faint groomer lines, fading in. */}
      <div className="absolute inset-x-0 top-[270px] bottom-0 bg-[#f5f8fb] bg-[repeating-linear-gradient(100deg,transparent_0_26px,rgba(19,33,58,.03)_26px_28px)] [mask-image:linear-gradient(180deg,transparent,#000_120px)]" />
      {/* Spruces at the edges of the piste. */}
      <Pines
        className="absolute bottom-0 left-0 hidden w-72 opacity-90 lg:block"
        trees={[
          [0, 1],
          [30, 0.8],
          [58, 0.62],
          [84, 0.45],
        ]}
      />
      <Pines
        className="absolute right-0 bottom-0 hidden w-80 opacity-90 lg:block"
        trees={[
          [70, 0.5],
          [96, 0.7],
          [126, 0.9],
          [158, 1],
        ]}
      />
    </div>
  )
}
