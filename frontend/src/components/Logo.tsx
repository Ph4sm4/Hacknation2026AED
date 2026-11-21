const HEART =
  "M32 38.5S18.5 30.4 18.5 21.6c0-4.2 3.3-7.3 7.1-7.3 2.8 0 5 1.5 6.4 3.8 1.4-2.3 3.6-3.8 6.4-3.8 3.8 0 7.1 3.1 7.1 7.3 0 8.8-13.5 16.9-13.5 16.9z";
const BOLT = "M34.6 17.2 27.4 27.4h4.3l-1.6 7 7.4-10.6h-4.3l1.4-6.6z";

/** GdzieAED sign (concept D – „Tablica”): square board, heart + defibrillation bolt, "tu jest" pointer. */
export function LogoMark({ className = "h-8 w-8", title, inverted = false }: { className?: string; title?: string; inverted?: boolean }) {
  const board = inverted ? "#FFFFFF" : "#C8102E";
  const sign = inverted ? "#C8102E" : "#FFFFFF";
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <rect width="64" height="64" rx="2" fill={board} />
      <g transform="translate(-15.41 -11.11) scale(1.4815)">
        <path fill={sign} d={HEART} />
        <path fill={board} d={BOLT} />
      </g>
      <path fill={sign} d="M26 52h12l-6 7z" />
    </svg>
  );
}

export function Logo({ inverted = false, size = "md" }: { inverted?: boolean; size?: "md" | "lg" }) {
  const mark = size === "lg" ? "h-24 w-24" : "h-10 w-10";
  const txt = size === "lg" ? "text-[44px] gap-[6px]" : "text-[19px] gap-[2px]";
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={`${mark} shrink-0`} inverted={inverted} />
      <span className={`flex flex-col font-extrabold uppercase leading-[0.78] tracking-[-0.02em] ${txt}`}>
        <span className={inverted ? "text-white" : "text-navy"}>Gdzie</span>
        <span className={inverted ? "text-white" : "text-brand"}>AED</span>
      </span>
    </span>
  );
}
