import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, Copy, Printer, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { money, type Txn } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FlameMark } from "./Logo";

const statusCls: Record<Txn["status"], string> = {
  Successful: "bg-success-soft text-success",
  Pending: "bg-chart-4/20 text-foreground",
  Failed: "bg-destructive/10 text-destructive",
};
const dotCls: Record<Txn["status"], string> = { Successful: "bg-success", Pending: "bg-chart-4", Failed: "bg-destructive" };

const fmt = (d: string) => new Date(d).toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const time = (d: string) => new Date(d).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (d: string) => {
  const t = new Date(d); const now = new Date(); const y = new Date(); y.setDate(now.getDate() - 1);
  if (t.toDateString() === now.toDateString()) return "Today";
  if (t.toDateString() === y.toDateString()) return "Yesterday";
  return t.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: t.getFullYear() === now.getFullYear() ? undefined : "numeric" });
};
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "•";

export function StatusBadge({ s }: { s: Txn["status"] }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${statusCls[s]}`}><span className={`h-1.5 w-1.5 rounded-full ${dotCls[s]}`} />{s}</span>;
}

function CopyRef({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" aria-label="Copy reference" className="ml-1 inline-grid h-6 w-6 place-items-center rounded-full text-muted-foreground opacity-0 transition hover:bg-primary/10 hover:text-primary group-hover:opacity-100 focus:opacity-100" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); }}>{done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>;
}

export function TransactionTable({ txns, balances }: { txns: Txn[]; balances?: Map<string, number> | undefined }) {
  const [sel, setSel] = useState<Txn | null>(null);
  const groups: { day: string; items: Txn[]; net: number }[] = [];
  for (const t of txns) {
    const day = dayLabel(t.date);
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) { g = { day, items: [], net: 0 }; groups.push(g); }
    g.items.push(t);
    if (t.status === "Successful") g.net += t.direction === "credit" ? (t.net ?? t.amount) : -(t.net ?? t.amount);
  }
  return (
    <>
      <div className="ledger-list overflow-hidden rounded-xl border border-border">
        {groups.map((g) => (
          <div key={g.day}>
            <div className="ledger-day flex items-center justify-between px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><span>{g.day}</span><span className="tabular-nums">{g.net >= 0 ? "+" : "−"}{money(Math.abs(g.net), g.items[0]?.currency)}</span></div>
            {g.items.map((t) => {
              const credit = t.direction === "credit";
              return (
                <button type="button" key={t.id} onClick={() => setSel(t)} className={`ledger-row group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_80px_auto_20px] ${balances ? "xl:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_80px_auto_120px_20px]" : ""}`}>
                  <span className={`ledger-avatar relative grid h-10 w-10 place-items-center rounded-full text-xs font-black ${credit ? "is-in" : "is-out"}`}>{initials(t.customer)}<span className="ledger-dir absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full">{credit ? <ArrowDownLeft className="h-2.5 w-2.5" /> : <ArrowUpRight className="h-2.5 w-2.5" />}</span></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-foreground">{t.customer}</span><span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><span className="ledger-channel">{t.channel}</span><span className="md:hidden">· {time(t.date)}</span></span></span>
                  <span className="hidden min-w-0 items-center font-mono text-xs text-muted-foreground md:flex"><span className="truncate">{t.ref}</span><CopyRef value={t.ref} /></span>
                  <span className="hidden text-xs text-muted-foreground md:block">{time(t.date)}</span>
                  <span className="flex flex-col items-end gap-1"><span className={`text-sm font-black tabular-nums ${credit ? "text-success" : "text-foreground"} ${t.status === "Failed" ? "line-through opacity-60" : ""}`}>{credit ? "+" : "−"}{money(t.amount, t.currency)}</span>{t.fee !== undefined && <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">Fee {money(t.fee, t.currency)} · {credit ? "You keep" : "Total"} {money(t.net ?? t.amount, t.currency)}</span>}<StatusBadge s={t.status} /></span>
                  {balances && <span className="hidden flex-col items-end xl:flex"><span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Balance</span><span className="text-xs font-bold tabular-nums">{money(balances.get(t.id) ?? 0, t.currency)}</span></span>}
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary md:block" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {sel && <ModalReceipt txn={sel} onClose={() => setSel(null)} />}
    </>
  );
}

export function ModalReceipt({ txn, onClose }: { txn: Txn; onClose: () => void }) {
  const credit = txn.direction === "credit";
  const rows: [string, string][] = [
    ["Reference", txn.ref],
    ...(txn.nipSessionId ? [["Session ID", txn.nipSessionId] as [string, string]] : []),
    ["Date", fmt(txn.date)],
    ["Channel", txn.channel],
    [credit ? "From" : "To", txn.customer],
    ["Type", credit ? "Money in" : "Money out"],
    ["Currency", txn.currency ?? "NGN"],
    ["Fee", txn.fee !== undefined ? money(txn.fee, txn.currency) : "Not charged or not reported"],
    ...(txn.fee !== undefined ? [[credit ? "You received" : "Total debited", money(txn.net ?? txn.amount, txn.currency)] as [string, string]] : []),
    ...(txn.note ? [["Note", txn.note] as [string, string]] : []),
  ];
  const text = `Slikpay receipt\n${credit ? "+" : "−"}${money(txn.amount, txn.currency)} · ${txn.status}\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`;
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: "Slikpay receipt", text }); else { await navigator.clipboard.writeText(text); toast.success("Receipt copied"); } } catch { /* cancelled */ }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onClose}>
      <div role="dialog" aria-label="Transaction receipt" className="slik-popup print-area panel w-full max-w-sm overflow-hidden p-0 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-head relative px-6 pb-6 pt-5 text-center">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><FlameMark className="h-7 w-7" /><span className="font-black">Slikpay Receipt</span></div>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
          <div className={`mx-auto mt-5 grid h-12 w-12 place-items-center rounded-full ${credit ? "receipt-ic-in" : "receipt-ic-out"}`}>{credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}</div>
          <div className="mt-3 text-3xl font-black tabular-nums">{credit ? "+" : "−"}{money(txn.amount, txn.currency)}</div>
          <div className="mt-2"><StatusBadge s={txn.status} /></div>
        </div>
        <dl className="space-y-3 border-t-[1.5px] border-dashed border-border px-6 py-5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="font-semibold text-muted-foreground">{k}</dt><dd className="min-w-0 break-all text-right font-bold text-foreground">{v}</dd></div>
          ))}
        </dl>
        <div className="grid grid-cols-2 gap-2 px-6 pb-6">
          <Button variant="crisp" className="rounded-full" onClick={share}><Share2 /> Share</Button>
          <Button variant="brand" className="rounded-full" onClick={() => window.print()}><Printer /> Print</Button>
        </div>
      </div>
    </div>
  );
}
