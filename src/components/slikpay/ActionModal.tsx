import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, naira, NG_BANKS, type Bank } from "@/lib/api";
import { Button } from "@/components/ui/button";

export type ActionKind = "send" | "bills" | "airtime" | "fund" | "swap" | "add" | "softpos";

const TITLES: Record<ActionKind, string> = {
  send: "Send Money (NIP)",
  bills: "Pay Utilities",
  airtime: "Buy Airtime & Data",
  fund: "Fund USD Virtual Card",
  swap: "Currency Swap",
  add: "Add Money",
  softpos: "SoftPOS — Accept Payment",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ActionModal({ kind, onClose }: { kind: ActionKind; onClose: () => void }) {
  const [banks, setBanks] = useState<Bank[]>(NG_BANKS);
  type Form = Partial<Record<"bank" | "acct" | "amount" | "narration" | "service" | "target" | "from" | "to", string>>;
  const [f, setF] = useState<Form>({ bank: "232", service: "power", from: "NGN", to: "USD" });
  const [acctName, setAcctName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (kind === "send") api.banks().then(setBanks);
  }, [kind]);
  useEffect(() => {
    if (kind !== "send" || (f.acct ?? "").length !== 10) {
      setAcctName("");
      return;
    }
    api.nameEnquiry(f.bank!, f.acct!).then((r) => setAcctName(r.accountName));
  }, [kind, f.bank, f.acct]);

  const amount = Number(f.amount || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind !== "softpos" && kind !== "add" && !(amount > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      let r: { message: string; ref: string } | undefined;
      if (kind === "send") r = await api.transfer({ recipientBank: f.bank!, accountNumber: f.acct ?? "", amount, narration: f.narration ?? "" });
      if (kind === "bills" || kind === "airtime") r = await api.payBill({ service: kind === "airtime" ? "airtime" : (f.service as "power" | "cable"), amount, meterOrPhone: f.target ?? "" });
      if (kind === "fund") r = await api.fundCard("crd_1", amount);
      if (kind === "swap") r = await api.swap({ fromCurrency: f.from!, toCurrency: f.to!, amount });
      const msg = r ? `${r.message} • ${r.ref}` : "Request received";
      setDone(msg);
      toast.success(r?.message ?? "Done");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/25 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label={TITLES[kind]} className="panel w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">{TITLES[kind]}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <p className="mt-3 font-bold text-foreground">{done}</p>
            <Button variant="brand" className="mt-6 w-full" onClick={onClose}>Done</Button>
          </div>
        ) : kind === "add" ? (
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-body">Transfer to your dedicated account from any Nigerian bank:</p>
            <div className="rounded-xl border-2 border-border p-4">
              <div className="font-mono text-2xl font-bold text-foreground">7946 4362 44</div>
              <div className="font-semibold text-muted-foreground">Sterling Bank • Slikpay</div>
            </div>
            <Button variant="brand" className="w-full" onClick={() => { navigator.clipboard?.writeText("7946436244"); toast.success("Account number copied"); }}>Copy account number</Button>
          </div>
        ) : kind === "softpos" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-dashed border-cyan text-sm font-bold text-body">Tap card here</div>
            <p className="text-sm font-semibold text-body">Ask your customer to tap their contactless card or phone on this device.</p>
            <Button variant="crisp" className="w-full" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {kind === "send" && (
              <>
                <Field label="Recipient bank">
                  <select className="field" value={f.bank} onChange={set("bank")}>{banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
                </Field>
                <Field label="Account number">
                  <input className="field font-mono" inputMode="numeric" maxLength={10} placeholder="0123456789" value={f.acct ?? ""} onChange={set("acct")} />
                </Field>
                {acctName && <div className="rounded-lg bg-success-soft px-3 py-2 text-sm font-bold text-success">{acctName}</div>}
              </>
            )}
            {kind === "bills" && (
              <Field label="Service">
                <select className="field" value={f.service} onChange={set("service")}><option value="power">Electricity</option><option value="cable">Cable TV</option></select>
              </Field>
            )}
            {(kind === "bills" || kind === "airtime") && (
              <Field label={kind === "airtime" ? "Phone number" : "Meter / smartcard number"}>
                <input className="field font-mono" inputMode="numeric" placeholder={kind === "airtime" ? "0803 000 0000" : "45012345678"} value={f.target ?? ""} onChange={set("target")} />
              </Field>
            )}
            {kind === "swap" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="From"><select className="field" value={f.from} onChange={set("from")}>{["NGN", "USD", "GBP", "USDT"].map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="To"><select className="field" value={f.to} onChange={set("to")}>{["USD", "NGN", "GBP", "USDT"].map((c) => <option key={c}>{c}</option>)}</select></Field>
              </div>
            )}
            <Field label={kind === "fund" ? "Amount (USD)" : `Amount (${kind === "swap" ? f.from : "NGN"})`}>
              <input className="field" inputMode="decimal" placeholder="0.00" value={f.amount ?? ""} onChange={set("amount")} />
            </Field>
            {kind === "send" && (
              <Field label="Narration"><input className="field" placeholder="What's this for?" value={f.narration ?? ""} onChange={set("narration")} /></Field>
            )}
            {kind === "send" && amount > 0 && <p className="text-xs font-semibold text-muted-foreground">You'll send {naira(amount)} + ₦10.75 fee</p>}
            <Button variant="brand" type="submit" disabled={busy} className="h-11 w-full">
              {busy && <Loader2 className="animate-spin" />} Continue
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
