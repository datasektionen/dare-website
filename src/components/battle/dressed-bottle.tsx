/** A cut-out stuck on a bottle photo, in the photo's own pixels. */
export type Sticker = {
  src: string
  /** Left edge, top edge and width. */
  x: number
  y: number
  width: number
  rotate?: number
  /** E.g. an animation that plays when the sticker appears. */
  className?: string
}

/** A bottle photo with props (hats, glasses...) slapped on it. */
export function DressedBottle({
  src,
  alt,
  width,
  height,
  stickers,
  className,
}: {
  src: string
  alt: string
  width: number
  height: number
  stickers: Sticker[]
  className?: string
}) {
  return (
    <div className={className} style={{ aspectRatio: `${width} / ${height}` }}>
      <div className="relative size-full">
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="size-full"
          draggable={false}
        />
        {stickers.map((s) => (
          <img
            key={s.src}
            src={s.src}
            alt=""
            className={`absolute h-auto max-w-none ${s.className ?? ""}`}
            style={{
              left: `${(s.x / width) * 100}%`,
              top: `${(s.y / height) * 100}%`,
              width: `${(s.width / width) * 100}%`,
              rotate: `${s.rotate ?? 0}deg`,
            }}
            draggable={false}
          />
        ))}
      </div>
    </div>
  )
}
