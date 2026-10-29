import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Check, ChevronDown, LogOut, Menu, Plus, RefreshCw, Search, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";
import { MERCHANT_GROUPS } from "@/lib/merchant";
import { PERSONAL_GROUPS } from "@/lib/personal";
import { Button } from "@/components/ui/button";
import { FlameMark, Logo } from "./Logo";
import { ComplianceFooter } from "./ComplianceFooter";
import { useBankingProfile } from "./PaddleConsole";
import { CurrencyBar, CurrencyWallet, PortfolioHeader } from "./CurrencyWallet";
import { captureInbound, useLiveUpdates } from "@/lib/live-updates";
import { setCurrency, useCurrency } from "@/lib/currency-store";
import { CURRENCIES, currencyDef } from "@/lib/wallets";
import { switchAccountMode } from "@/lib/kyb.functions";

export interface NavItem { label: string; icon: LucideIcon; id?: string }
export function AppShell({ mode, nav, children, greeting, activeModule, onModuleChange, search = "", onSearchChange, tierBadge, onAddMoney, onRefresh, bottomNav, bottomAction }: { mode: Role; nav: NavItem[]; children: ReactNode; greeting?: string; activeModule?: string; onModuleChange?: (id: string) => void; search?: string; onSearchChange?: (value: string) => void; tierBadge?: string; onAddMoney?: () => void; onRefresh?: () => Promise<void>; bottomNav?: NavItem[]; bottomAction?: { label: string; onClick: () => void } }) {
  const { user, profile, txns, ready, token, signOut, setRole } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(nav[0]?.label ?? "Dashboard");
  const [open, setOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [unread, setUnread] = useState(true);
  const { profile: banking, refresh: bankingRefresh } = useBankingProfile();
  const environment = banking?.mode === "live" ? "Live Mode" : "Sandbox";
  const currency = useCurrency();
  const [modeBusy, setModeBusy] = useState(false);
  const canLive = banking?.review === "approved";
  const changeMode = async (m: "sandbox" | "live") => {
    if (modeBusy || banking?.mode === m) return;
    if (m === "live" && !canLive) { toast.message("Finish verification to go live", { action: { label: "Continue", onClick: () => onModuleChange?.("golive") } }); return; }
    setModeBusy(true);
    try { await switchAccountMode({ data: { mode: m } }); await bankingRefresh(); toast.success(m === "live" ? "Live mode on — real money" : "Sandbox on — test money only"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not switch mode."); }
    finally { setModeBusy(false); }
  };
  const [currencies, setCurrencies] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [menuQ, setMenuQ] = useState("");
  const [folded, setFolded] = useState<string[]>([]);
  useEffect(() => { try { setFolded(JSON.parse(localStorage.getItem("slik.menu.folded") ?? "[]")); } catch { /* ignore */ } }, []);
  const toggleFold = (t: string) => setFolded((f) => { const next = f.includes(t) ? f.filter((x) => x !== t) : [...f, t]; try { localStorage.setItem("slik.menu.folded", JSON.stringify(next)); } catch { /* ignore */ } return next; });
  const doRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await captureInbound(); await Promise.all([bankingRefresh(), onRefresh?.() ?? Promise.resolve()]);
      setUpdatedAt(new Date());
      toast.success("Dashboard refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed — try again");
    } finally { setRefreshing(false); }
  };
  const updatedLabel = updatedAt ? `Updated ${updatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : "";
  useLiveUpdates(user?.id, async () => { await Promise.all([bankingRefresh(), onRefresh?.() ?? Promise.resolve()]); setUpdatedAt(new Date()); });
  useEffect(() => { if (ready && !token) navigate({ to: "/auth" }); }, [ready, token, navigate]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape); };
  }, [open]);
  const name = user?.name ?? "";
  const initials = user?.initials ?? "—";
  const notes = [...(banking?.receipts ?? []).slice(0, 6).map((r) => ({ id: r.id, at: r.created_at, text: `${r.status === "succeeded" ? "Completed" : r.status === "failed" ? "Failed" : "Pending"}: ${r.operation.startsWith("SWAP") ? r.operation.replace("->", " → ").replace("SWAP", "Swap") : r.operation.startsWith("WITHDRAW") ? "Withdrawal" : "Transfer"} · ${r.currency ?? ""} ${Number(r.amount ?? 0).toLocaleString()}` })), ...txns.filter((t) => t.direction === "credit").slice(0, 6).map((t) => ({ id: t.id, at: t.date, text: `Received ${t.amount.toLocaleString(undefined, { style: "currency", currency: "NGN" })} from ${t.customer}` }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const isBiz = mode === "merchant";
  const groups = onModuleChange ? (isBiz ? MERCHANT_GROUPS : PERSONAL_GROUPS) : [{ title: "", items: nav }];
  const goMode = (r: Role) => { setRole(r); setSwitcher(false); if (r === "merchant") navigate({ to: "/dashboard", search: { module: "overview" } }); else navigate({ to: "/personal", search: { module: "home" } }); };
  const sidebar = <aside className="merchant-sidebar flex h-full w-[260px] flex-col border-r border-border bg-background/95 backdrop-blur-2xl">
    <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-4">
      {isBiz ? <div className="flex items-center gap-2"><FlameMark className="h-7 w-7" /><div className="leading-none"><div className="text-base font-extrabold">SLIKPAY<span className="text-cyan">.</span></div><p className="mt-0.5 text-[10px] sidebar-meta">Business</p></div></div> : <Logo sub="Personal" />}
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X /></Button>
    </div>
    {onModuleChange && <div className="shrink-0 px-3 pb-2"><label className="relative block"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 sidebar-meta" /><input value={menuQ} onChange={(e) => setMenuQ(e.target.value)} placeholder="Search menu" aria-label="Find a menu item" className="sidebar-search h-8 w-full rounded-md pl-8 pr-10 text-xs" /><kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border px-1 font-mono text-[9px] sidebar-meta">⌘K</kbd></label></div>}
    <nav aria-label="Main navigation" className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      {groups.map((g) => { const q = menuQ.trim().toLowerCase(); const items = q ? g.items.filter((i) => `${i.label} ${g.title}`.toLowerCase().includes(q)) : g.items; if (!items.length) return null;
        const hasActive = items.some((i) => i.id === activeModule); const closed = !q && !hasActive && folded.includes(g.title);
        return <div key={g.title} className="mb-1">{g.title && <button type="button" onClick={() => toggleFold(g.title)} aria-expanded={!closed} className="group flex w-full items-center justify-between px-2.5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.08em] sidebar-group-title"><span>{g.title}</span><ChevronDown className={`h-3 w-3 opacity-0 transition group-hover:opacity-100 ${closed ? "-rotate-90 opacity-100" : ""}`} /></button>}{!closed && items.map(({ label: rawLabel, icon: Icon, id }) => { const label = id === "golive" && banking?.mode === "live" ? "KYB" : rawLabel;
        const selected = activeModule ? activeModule === id : active === label;
        const classes = `sidebar-item flex h-8 w-full items-center justify-start gap-2.5 rounded-md px-2.5 text-left text-[13px] ${selected ? "sidebar-item-active" : "font-semibold"}`;
        return onModuleChange && id ? <Link key={label} to={isBiz ? "/dashboard" : "/personal"} search={{ module: id }} aria-current={selected ? "page" : undefined} onClick={() => setOpen(false)} className={classes}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></Link> : <button type="button" key={label} className={classes} onClick={() => { setActive(label); setOpen(false); }}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></button>;
      })}</div>; })}
    </nav>
    <div className="shrink-0 border-t border-border p-2">
      <div className="flex items-center gap-2 rounded-lg p-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[11px] font-black text-primary-foreground">{initials}</span>
        <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{isBiz ? (profile?.company_name ?? "Your business") : name}</div><div className="truncate text-[10px] sidebar-meta">{refreshing ? "Refreshing…" : updatedLabel || (isBiz ? `${name} · Director` : "Personal")}</div></div>
        <button type="button" onClick={doRefresh} disabled={refreshing} aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"} className="sidebar-icon-btn"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyan" : ""}`} /></button>
        <button type="button" onClick={() => { signOut(); navigate({ to: "/auth" }); }} aria-label="Sign out" className="sidebar-icon-btn hover:text-destructive"><LogOut className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  </aside>;
  return <div className={"theme-flame merchant-console relative flex min-h-screen bg-mesh"}>
    <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</div>
    {open && <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}><div role="dialog" aria-modal="true" aria-label="Navigation menu" className="h-full w-[260px]" onClick={(e) => e.stopPropagation()}>{sidebar}</div></div>}
    <div className="light-workspace min-w-0 flex-1 overflow-x-clip w-full max-w-full">
      <header className="topbar-midnight sticky top-0 z-30 flex h-14 sm:h-16 lg:h-[72px] items-center gap-1 sm:gap-2 px-2.5 sm:px-4 backdrop-blur-2xl md:gap-4 md:px-7 max-w-full overflow-hidden">
        <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></Button>
        {greeting && <div className="hidden shrink-0 xl:block"><h1 className="text-lg font-black">{greeting}</h1>{tierBadge && <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" />{tierBadge}</p>}</div>}
        {onAddMoney && <Button variant="brand" size="sm" className="hidden shrink-0 rounded-full md:inline-flex" onClick={onAddMoney}><Plus /> Add Money</Button>}
        <label className="topbar-search group relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" /><input aria-label="Global search" className="h-10 w-full rounded-full bg-transparent pl-10 pr-14 text-base sm:text-xs md:text-[13px] outline-none placeholder:text-muted-foreground" placeholder="Search..." value={onSearchChange ? search : undefined} onChange={(e) => onSearchChange?.(e.target.value)} /><kbd className="topbar-kbd absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline">⌘K</kbd></label>
        <Button variant="ghost" size="icon" className="topbar-icon hidden shrink-0 sm:inline-flex" aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"} onClick={doRefresh} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-cyan" : ""}`} /></Button>
        <div className="relative shrink-0"><Button variant="crisp" size="sm" className="topbar-chip" onClick={() => { setCurrencies(!currencies); setSwitcher(false); setNotifications(false); }} aria-expanded={currencies}> {currencyDef(currency)?.flag} {currency}<ChevronDown /></Button>{currencies && <div className="merchant-popover absolute right-0 mt-3 w-40 rounded-lg border border-border bg-background p-2 shadow-cobalt">{CURRENCIES.map(({ code: c, flag, name }) => <Button key={c} variant="ghost" className="w-full justify-between" title={name} onClick={() => { setCurrency(c); setCurrencies(false); if (onModuleChange && activeModule !== "overview" && activeModule !== "home") onModuleChange(isBiz ? "overview" : "home"); }}><span>{flag} {c}</span>{c === currency && <Check />}</Button>)}</div>}</div>
        <div className="relative flex shrink-0 items-center gap-1"><div role="radiogroup" aria-label="Account mode" className={`mode-switch hidden md:inline-grid ${banking?.mode === "live" ? "is-live" : "is-sandbox"}`} aria-busy={modeBusy}><span className="mode-thumb" aria-hidden /><button type="button" role="radio" aria-checked={banking?.mode !== "live"} onClick={() => changeMode("sandbox")} disabled={modeBusy}><span className="mode-dot bg-chart-4" />Sandbox</button><button type="button" role="radio" aria-checked={banking?.mode === "live"} onClick={() => changeMode("live")} disabled={modeBusy} title={canLive ? "Switch to live" : "Finish verification to go live"}><span className="mode-dot bg-success" />Live</button></div><Button variant="ghost" size="icon" className="topbar-icon h-8 w-8" onClick={() => { setSwitcher(!switcher); setCurrencies(false); setNotifications(false); }} aria-expanded={switcher} aria-label="Account menu"><ChevronDown className="h-4 w-4" /></Button>{switcher && <div className="merchant-popover absolute right-0 top-full mt-3 w-52 rounded-lg border border-border bg-background p-2 shadow-cobalt"><div className="flex items-center justify-between px-3 py-2 text-xs font-semibold">{environment}<Check className="h-4 w-4 text-cyan" /></div><div className="flex gap-1.5 px-2 pb-2 md:hidden">{(["sandbox", "live"] as const).map((m) => <button key={m} type="button" disabled={modeBusy} onClick={() => void changeMode(m)} title={m === "live" && !canLive ? "Finish verification to go live" : `Switch to ${m}`} className={`h-8 flex-1 rounded-full border text-[11px] font-bold capitalize transition-colors ${banking?.mode === m ? "border-cobalt bg-cobalt text-primary-foreground" : "border-border text-muted-foreground"}`}>{m}</button>)}</div>{environment !== "Live Mode" && <Button variant="ghost" className="w-full justify-start text-xs text-magenta" onClick={() => { setSwitcher(false); onModuleChange?.("golive"); }}>Complete verification to go live →</Button>}<div className="my-1 border-t border-border" /><Button variant="ghost" className="w-full justify-start text-xs" onClick={() => goMode(isBiz ? "personal" : "merchant")}>{isBiz ? "Personal Wallet" : "Business Console"}</Button></div>}</div>
        <div className="relative shrink-0"><Button variant="ghost" size="icon" className="topbar-icon relative" aria-label="Notifications" aria-expanded={notifications} onClick={() => { setNotifications(!notifications); setSwitcher(false); setCurrencies(false); }}><Bell />{unread && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-magenta" />}</Button>{notifications && <div className="merchant-popover absolute right-0 mt-3 w-[min(300px,85vw)] rounded-lg border border-border bg-background p-5 shadow-cobalt"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Notifications</h2><Button variant="ghost" size="sm" onClick={() => setUnread(false)}>Mark read</Button></div>{notes.length ? <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">{notes.map((n) => <li key={n.id} className="rounded-lg bg-muted/40 p-2 text-xs"><p className="font-semibold">{n.text}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.at).toLocaleString()}</p></li>)}</ul> : <p className="mt-4 text-xs text-muted-foreground">No activity yet. Payments and transfers will appear here.</p>}</div>}</div>
      </header>
      {banking && environment === "Sandbox" && <div className="border-b border-magenta/30 bg-magenta/10 px-7 py-2 text-xs font-semibold text-foreground">Sandbox · test money only. Real transactions start after verification and approval.</div>}
      <main className={`space-y-3.5 sm:space-y-5 p-2.5 sm:p-5 md:p-7 w-full max-w-full min-w-0 overflow-x-clip ${bottomNav ? "pb-28 lg:pb-7" : ""}`}>
        {onModuleChange && (!activeModule || activeModule === "overview" || activeModule === "home") && <PortfolioHeader />}
        {onModuleChange && <CurrencyBar current={currency} onPick={(c) => { setCurrency(c); if (activeModule !== (isBiz ? "overview" : "home")) onModuleChange(isBiz ? "overview" : "home"); }} />}
        {currency !== "NGN" && (!activeModule || activeModule === "overview" || activeModule === "home") && <CurrencyWallet key={currency} code={currency} mode={banking?.mode} onNavigate={onModuleChange} />}
        {children}<ComplianceFooter /></main>
      {bottomNav && (
        <nav aria-label="Quick navigation" className="mobile-tabbar fixed inset-x-1.5 sm:inset-x-3 bottom-2 sm:bottom-3 z-40 flex items-stretch justify-around gap-0.5 sm:gap-1 rounded-2xl sm:rounded-3xl border border-border bg-background/95 px-1 sm:px-2 py-1 sm:py-1.5 shadow-[0_18px_50px_-12px_color-mix(in_oklab,var(--cobalt)_45%,transparent)] backdrop-blur-2xl lg:hidden max-w-[calc(100vw-12px)] sm:max-w-[calc(100vw-16px)] mx-auto" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          {bottomNav.map(({ label, icon: Icon, id }, i) => {
            const selected = activeModule ? activeModule === id : active === label;
            const isMore = id === "more";
            return (
              <div key={label} className="flex flex-1 items-center justify-center">
                <button
                  onClick={() => { if (isMore) { setOpen(true); return; } if (onModuleChange && id) onModuleChange(id); else setActive(label); }}
                  aria-current={selected ? "page" : undefined}
                  aria-label={isMore ? "Open full menu" : label}
                  className={`flex min-h-[46px] sm:min-h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 sm:px-1 text-[9px] sm:text-[10px] font-bold transition-colors ${selected ? "bg-cobalt/10 text-cobalt" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={selected ? 2.4 : 2} />
                  <span className="truncate">{label}</span>
                  <span className={`h-1 w-1 rounded-full transition-opacity ${selected ? "bg-magenta opacity-100" : "opacity-0"}`} aria-hidden />
                </button>
                {bottomAction && i === Math.floor((bottomNav.length - 1) / 2) && (
                  <button
                    onClick={bottomAction.onClick}
                    aria-label={bottomAction.label}
                    className="shine mx-0.5 sm:mx-1 flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 -translate-y-2 sm:-translate-y-3 items-center justify-center rounded-2xl bg-gradient-tri text-primary-foreground shadow-cobalt transition-transform active:scale-95"
                  >
                    <Plus className="h-6 w-6" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      )}
    </div>
  </div>;
}
export function ViewAll() { return <Link to="/dashboard" search={{ module: "transactions" }} className="text-sm font-bold text-cobalt hover:underline">View all →</Link>; }
