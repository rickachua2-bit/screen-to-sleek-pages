export function FlameMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M20 3c3 7 10 10 10 19a10 10 0 0 1-20 0c0-5 3-8 5-11 1 3 2 5 5 6-1-6 0-10 0-14Z" className="fill-cobalt" />
      <path d="M21 16c2 4 6 6 6 10a7 7 0 0 1-12 5c4 0 0 6-3 6-6 0-3-1-5 0-9Z" className="fill-magenta" />
      <path d="M17 26c1 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5Z" className="fill-cyan" />
    </svg>
  );
}

export function Logo({ sub, hideSubOnMobile }: { sub?: string; hideSubOnMobile?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <FlameMark className="h-9 w-9 flame-glow shrink-0" />
      <div className="leading-tight">
        <div className="text-lg font-black tracking-tight text-foreground">Slikpay</div>
        {sub && <div className={`text-[11px] font-semibold text-muted-foreground ${hideSubOnMobile ? "hidden sm:block" : ""}`}>{sub}</div>}
      </div>
    </div>
  );
}
