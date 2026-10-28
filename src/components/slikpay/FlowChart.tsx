import { money, type Txn } from "@/lib/api";

/** Money in vs money out per day for the filtered rows (successful only). */
export function FlowChart({ txns, currency = "NGN" }: { txns: Txn[]; currency?: string }) {
  const map = new Map<string, { inn: number; out: number }>();
  for (const t of txns) {
    if (t.status !== "Successful") continue;
    const k = t.date.slice(0, 10);
    const v = map.get(k) ?? { inn: 0, out: 0 };
    if (t.direction === "credit") v.inn += t.amount; else v.out += t.amount;
    map.set(k, v);
  }
  const days = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-21);
  if (!days.length) return null;
  const max = Math.max(1, ...days.flatMap(([, v]) => [v.inn, v.out]));
  return <div className="ledger-chart mb-5 rounded-xl border border-border p-4">
    <div className="mb-3 flex items-center justify-between text-xs"><span className="font-bold">Money in vs out</span><span className="flex gap-3 text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-success" />In</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" />Out</span></span></div>
    <div className="flex h-28 items-end gap-1.5">
      {days.map(([d, v]) => <div key={d} className="group relative flex h-full flex-1 items-end justify-center gap-0.5" title={`${new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · in ${money(v.inn, currency)} · out ${money(v.out, currency)}`}>
        <span className="w-1/2 max-w-3 rounded-t bg-success transition-all group-hover:opacity-80" style={{ height: `${Math.max(2, (v.inn / max) * 100)}%` }} />
        <span className="w-1/2 max-w-3 rounded-t bg-primary transition-all group-hover:opacity-80" style={{ height: `${Math.max(2, (v.out / max) * 100)}%` }} />
      </div>)}
    </div>
    <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{new Date(days[0]![0]).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span><span>{new Date(days[days.length - 1]![0]).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span></div>
  </div>;
}
