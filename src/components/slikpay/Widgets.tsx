import { useState, type ReactNode } from "react";
import { Copy, Eye, EyeOff, Landmark, MoreVertical, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { naira } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CardGraphic } from "./CardGraphic";

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel p-5 ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
          {action ?? <MoreVertical className="h-4 w-4 text-muted-foreground" />}
        </div>
      )}
      {children}
    </section>
  );
}

export function BalanceCard({ title, balance, sub, footer }: { title: string; balance: number; sub: string; footer?: ReactNode }) {
  const [show, setShow] = useState(true);
  return (
    <Panel
      title={title}
      action={
        <div className="flex items-center gap-1 text-muted-foreground">
          <button aria-label={show ? "Hide balance" : "Show balance"} onClick={() => setShow(!show)} className="rounded-md p-1 hover:bg-muted">
            {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <MoreVertical className="h-4 w-4" />
        </div>
      }
    >
      <div className="text-3xl font-black tracking-tight text-foreground">{show ? naira(balance) : "••••••••"}</div>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">{sub}</p>
      {footer && <div className="mt-5 border-t-[1.5px] border-border pt-4">{footer}</div>}
    </Panel>
  );
}

export function NubanCard({ nuban = "7946436244", label = "Slikpay Business", title = "Dedicated NUBAN Account" }: { nuban?: string; label?: string; title?: string }) {
  const pretty = `${nuban.slice(0, 4)} ${nuban.slice(4, 8)} ${nuban.slice(8)}`;
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cobalt/10 text-cobalt"><Landmark className="h-5 w-5" /></span>
          <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
        </div>
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-5 font-mono text-3xl font-bold tracking-wider text-foreground">{pretty}</div>
      <p className="mt-1 text-sm font-semibold text-body">Sterling Bank • {label}</p>
      <Button
        variant="crisp"
        className="mt-5 rounded-full"
        onClick={async () => {
          try { await navigator.clipboard.writeText(nuban); } catch { /* clipboard unavailable */ }
          toast.success("Account number copied", { description: nuban });
        }}
      >
        <Copy /> Copy Account Number
      </Button>
    </Panel>
  );
}

export function UsdCardPanel({ balance = 0, label, onFund, note }: { balance?: number; label?: string; onFund: () => void; note?: string }) {
  return (
    <Panel>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-foreground">USD Virtual Mastercard</h3>
          <div className="mt-4 text-3xl font-black text-foreground">${balance.toFixed(2)}</div>
          <p className="text-sm font-semibold text-muted-foreground">Available balance</p>
          {note && <p className="mt-2 max-w-[200px] text-xs font-semibold text-body">{note}</p>}
          <Button variant="obsidian" className="mt-5" onClick={onFund}>Fund Card</Button>
        </div>
        <CardGraphic label={label} />
      </div>
    </Panel>
  );
}

export function QuickAction({ icon: Icon, title, sub, tone, onClick }: { icon: LucideIcon; title: string; sub: string; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="panel group flex flex-col items-start gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-cyan hover:shadow-md">
      <span className={`flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground ${tone}`}><Icon className="h-5 w-5" /></span>
      <div>
        <div className="text-sm font-extrabold text-foreground">{title}</div>
        <div className="text-xs font-semibold text-muted-foreground">{sub}</div>
      </div>
    </button>
  );
}
