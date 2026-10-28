const DONUT = [
  { label: "NIP", pct: 52.1, cls: "stroke-cobalt", dot: "bg-cobalt" },
  { label: "SoftPOS", pct: 28.4, cls: "stroke-navy", dot: "bg-navy" },
  { label: "Treasury Sweep", pct: 19.5, cls: "stroke-cyan", dot: "bg-cyan" },
];

export function DonutChart({ data = DONUT, center = "₦0", sub = "Total Inflow" }: { data?: typeof DONUT; center?: string; sub?: string }) {
  if (!data.length) return <div className="flex h-32 flex-col items-center justify-center text-center"><span className="text-2xl font-black">{center}</span><span className="mt-1 text-xs text-muted-foreground">No inflow yet — channels appear once payments arrive.</span></div>;
  const r = 40;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="-rotate-90">
          {data.map((d) => {
            const len = (d.pct / 100) * c;
            const el = <circle key={d.label} cx="50" cy="50" r={r} fill="none" strokeWidth="14" className={d.cls} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />;
            off += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-black text-foreground">{center}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">{sub}</span>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${d.dot}`} />
            <span className="font-semibold text-body">{d.label}</span>
            <span className="ml-auto pl-3 font-extrabold text-foreground">{d.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const compact = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n));
export const CHANNEL_STYLES = [
  { cls: "stroke-cobalt", dot: "bg-cobalt" }, { cls: "stroke-cyan", dot: "bg-cyan" }, { cls: "stroke-magenta", dot: "bg-magenta" }, { cls: "stroke-navy", dot: "bg-navy" },
];

export function BarChart({ days = [] }: { days?: { label: string; value: number }[] }) {
  if (!days.some((d) => d.value > 0)) return <div className="flex h-36 items-center justify-center text-center text-xs text-muted-foreground">No inflow in the last 30 days.</div>;
  const max = Math.max(...days.map((d) => d.value));
  const BARS = days.map((d) => d.value / max * 2);
  return (
    <div className="flex h-36 gap-2">
      <div className="flex flex-col justify-between pb-5 text-[10px] font-semibold text-muted-foreground">
        {[1, 0.75, 0.5, 0.25, 0].map((f) => <span key={f}>{compact(max * f)}</span>)}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-end gap-[3px] border-b-[1.5px] border-border">
          {BARS.map((v, i) => (
            <div key={i} title={`${days[i]?.label}: ₦${(days[i]?.value ?? 0).toLocaleString()}`} className="flex-1 rounded-t-sm bg-gradient-bar transition-opacity hover:opacity-80" style={{ height: `${(v / 2) * 100}%` }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
          <span>{days[0]?.label}</span><span>{days[Math.floor(days.length / 2)]?.label}</span><span>{days[days.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}
