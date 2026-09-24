/** Big pink pill button with an arrow, used for the ticket CTA. */
export function TicketButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex cursor-pointer items-center gap-3.5 rounded-full bg-[#e83d84] py-2.5 pr-2.5 pl-7 font-['Instrument_Sans',sans-serif] text-[17px] font-semibold tracking-[.01em] text-white no-underline shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_12px_40px_rgba(232,61,132,.45)] transition-[transform,box-shadow,background] duration-250 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-0.5 hover:bg-[#f0529a] hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_18px_60px_rgba(232,61,132,.6)] active:translate-y-0 active:scale-[.98]"
    >
      <span>{label}</span>
      <span className="flex size-10 items-center justify-center rounded-full bg-white text-lg text-[#c92c6d]">
        →
      </span>
    </a>
  )
}
