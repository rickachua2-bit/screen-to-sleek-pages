const DONUT = [
  { label: "NIP", pct: 52.1, cls: "stroke-cobalt", dot: "bg-cobalt" },
  { label: "SoftPOS", pct: 28.4, cls: "stroke-navy", dot: "bg-navy" },
  { label: "Treasury Sweep", pct: 19.5, cls: "stroke-cyan", dot: "bg-cyan" },
];

export function DonutChart({ data = DONUT, center = "₦12.4M", sub = "Total Inflow" }: { data?: typeof DONUT; center?: string; sub?: string }) {
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

const BARS = [0.9, 1.2, 0.7, 1.5, 1.1, 1.8, 1.3, 0.6, 1.4, 1.9, 1.0, 1.6, 1.2, 1.7, 0.8];

export function BarChart() {
  const max = 2.0;
  return (
    <div className="flex h-36 gap-2">
      <div className="flex flex-col justify-between pb-5 text-[10px] font-semibold text-muted-foreground">
        {["2.0M", "1.5M", "1.0M", "500K", "0"].map((l) => <span key={l}>{l}</span>)}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-end gap-[3px] border-b-[1.5px] border-border">
          {BARS.map((v, i) => (
            <div key={i} title={`Oct ${i * 2 + 1}: ₦${v}M`} className="flex-1 rounded-t-sm bg-gradient-bar transition-opacity hover:opacity-80" style={{ height: `${(v / max) * 100}%` }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
          <span>Oct 1</span><span>Oct 15</span><span>Oct 30</span>
        </div>
      </div>
    </div>
  );
}
