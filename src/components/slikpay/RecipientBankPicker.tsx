import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RecipientBank = { code: string; name: string };
export function RecipientBankPicker({ banks, bank, error, onRetry, onSelect }: { banks: RecipientBank[] | null; bank: RecipientBank | null; error: string; onRetry: () => void; onSelect: (bank: RecipientBank) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const id = useId();
  const filtered = useMemo(() => (banks ?? []).filter((b) => `${b.name} ${b.code}`.toLowerCase().includes(query.trim().toLowerCase())), [banks, query]);
  return <div className="recipient-bank-picker">
    <label htmlFor={id} className="mb-1.5 block text-xs font-bold text-foreground">Recipient bank</label>
    <div className="recipient-bank-search"><Search className="h-4 w-4 shrink-0" /><input id={id} type="search" role="combobox" aria-label="Search recipient bank" aria-expanded={open} aria-controls={`${id}-results`} autoComplete="off" placeholder={banks === null ? "Loading banks…" : "Search bank name or code"} value={query} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); document.getElementById(`${id}-first`)?.focus(); } }} /><Button variant="ghost" size="icon" aria-label={open ? "Hide banks" : "Show all banks"} onClick={() => setOpen(!open)}><ChevronDown className="h-4 w-4" /></Button></div>
    {bank && <div className="recipient-bank-selected"><Check className="h-4 w-4" /><span>{bank.name}</span><span className="ml-auto font-mono text-xs">{bank.code}</span></div>}
    {error && <div role="alert" className="mt-2 flex items-center justify-between gap-2 text-xs text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div>}
    {open && <div id={`${id}-results`} className="recipient-bank-results" role="listbox" aria-label="Supported banks">
      {banks === null ? <p role="status" className="flex items-center gap-2 p-3 text-xs"><Loader2 className="h-4 w-4 animate-spin" />Loading supported banks…</p> : filtered.length ? filtered.map((b, i) => <Button key={b.code} id={i === 0 ? `${id}-first` : undefined} variant="ghost" role="option" aria-selected={bank?.code === b.code} className="recipient-bank-option" onClick={() => { onSelect(b); setQuery(""); setOpen(false); }}><span>{b.name}</span><span className="font-mono text-xs">{bank?.code === b.code ? <Check className="h-4 w-4" /> : b.code}</span></Button>) : <p className="p-3 text-xs text-muted-foreground">{error ? "Bank list unavailable. Retry loading." : "No matching banks."}</p>}
    </div>}
  </div>;
}