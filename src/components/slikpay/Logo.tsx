import markAsset from "@/assets/slikcash-mark.png.asset.json";

export function FlameMark({ className = "h-9 w-9" }: { className?: string }) {
  return <img src={markAsset.url} alt="" aria-hidden draggable={false} className={`object-contain ${className}`} />;
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
