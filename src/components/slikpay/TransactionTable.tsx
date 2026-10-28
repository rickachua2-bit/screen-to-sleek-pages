import { useState } from "react";
import { Printer, X } from "lucide-react";
import { naira, type Txn } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FlameMark } from "./Logo";

const statusCls: Record<Txn["status"], string> = {
  Successful: "bg-success-soft text-success",
  Pending: "bg-chart-4/20 text-foreground",
  Failed: "bg-destructive/10 text-destructive",
};

const fmt = (d: string) => new Date(d).toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function StatusBadge({ s }: { s: Txn["status"] }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusCls[s]}`}>{s}</span>;
}

export function TransactionTable({ txns }: { txns: Txn[] }) {
  const [sel, setSel] = useState<Txn | null>(null);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b-[1.5px] border-border text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {["Date & Time", "Reference", "Channel", "Customer", "Amount", "Status", "Receipt"].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/60">
                <td className="px-3 py-3 font-semibold text-body">{fmt(t.date)}</td>
                <td className="px-3 py-3 font-mono text-xs text-body">{t.ref}</td>
                <td className="px-3 py-3 font-semibold text-body">{t.channel}</td>
                <td className="px-3 py-3 font-bold text-foreground">{t.customer}</td>
                <td className={`px-3 py-3 font-extrabold ${t.direction === "credit" ? "text-success" : "text-foreground"}`}>
                  {t.direction === "credit" ? "+" : "−"}{naira(t.amount)}
                </td>
                <td className="px-3 py-3"><StatusBadge s={t.status} /></td>
                <td className="px-3 py-3">
                  <Button variant="crisp" size="sm" onClick={() => setSel(t)}>View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && <ModalReceipt txn={sel} onClose={() => setSel(null)} />}
    </>
  );
}

export function ModalReceipt({ txn, onClose }: { txn: Txn; onClose: () => void }) {
  const rows: [string, string][] = [
    ["Reference", txn.ref],
    ...(txn.nipSessionId ? [["Central NIP Session ID", txn.nipSessionId] as [string, string]] : []),
    ["Date", fmt(txn.date)],
    ["Channel", txn.channel],
    [txn.direction === "credit" ? "From" : "To", txn.customer],
    ["Settlement", "Slikpay"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4" onClick={onClose}>
      <div role="dialog" aria-label="Transaction receipt" className="slik-popup print-area panel w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><FlameMark className="h-7 w-7" /><span className="font-black">Slikpay Receipt</span></div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="my-6 text-center">
          <div className="text-3xl font-black text-foreground">{naira(txn.amount)}</div>
          <div className="mt-2"><StatusBadge s={txn.status} /></div>
        </div>
        <dl className="space-y-3 border-t-[1.5px] border-dashed border-border pt-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="font-semibold text-muted-foreground">{k}</dt><dd className="min-w-0 break-all text-right font-bold text-foreground">{v}</dd></div>
          ))}
        </dl>
        <Button variant="brand" className="mt-6 w-full" onClick={() => window.print()}><Printer /> Print receipt</Button>
      </div>
    </div>
  );
}
