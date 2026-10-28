import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Check, ChevronDown, LogOut, Menu, Search, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";
import { MERCHANT_GROUPS } from "@/lib/merchant";
import { Button } from "@/components/ui/button";
import { FlameMark, Logo } from "./Logo";

export interface NavItem { label: string; icon: LucideIcon; id?: string }
export function AppShell({ mode, nav, children, greeting, activeModule, onModuleChange, search = "", onSearchChange }: { mode: Role; nav: NavItem[]; children: ReactNode; greeting?: string; activeModule?: string; onModuleChange?: (id: string) => void; search?: string; onSearchChange?: (value: string) => void }) {
  const { user, ready, token, signOut, setRole } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(nav[0]?.label ?? "Dashboard");
  const [open, setOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [unread, setUnread] = useState(true);
  const [environment, setEnvironment] = useState("Live Mode");
  const [currency, setCurrency] = useState("NGN");
  const [currencies, setCurrencies] = useState(false);
  useEffect(() => { if (ready && !token) navigate({ to: "/auth" }); }, [ready, token, navigate]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape); };
  }, [open]);
  const name = user?.name ?? "Patrick Otu";
  const initials = user?.initials ?? "PO";
  const isBiz = mode === "merchant";
  const groups = isBiz && onModuleChange ? MERCHANT_GROUPS : [{ title: "", items: nav }];
  const goMode = (r: Role) => { setRole(r); setSwitcher(false); navigate({ to: r === "merchant" ? "/dashboard" : "/personal" }); };
  const sidebar = <aside className="merchant-sidebar flex h-full w-[260px] flex-col border-r border-border bg-background/95 backdrop-blur-2xl">
    <div className="flex shrink-0 items-center justify-between px-5 py-6">
      {isBiz ? <div className="flex items-center gap-2"><FlameMark className="h-9 w-9" /><div><div className="text-xl font-extrabold">SLIKPAY<span className="text-cyan">.</span></div><p className="text-[10px] text-muted-foreground">Business · by Sterling Bank</p></div></div> : <Logo sub="Personal · by Sterling Bank" />}
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X /></Button>
    </div>
    <nav aria-label="Main navigation" className="dropdown-list min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {groups.map((g) => <div key={g.title} className="mb-3">{g.title && <h2 className="px-2 pb-2 pt-3 text-xs font-bold uppercase text-muted-foreground/80">{g.title}</h2>}{g.items.map(({ label, icon: Icon, id }) => {
        const selected = activeModule ? activeModule === id : active === label;
        const classes = `merchant-nav-item mb-1.5 flex h-auto min-h-11 w-full justify-start gap-3 whitespace-normal rounded-lg px-3 py-3 text-left text-sm leading-5 ${selected ? "bg-gradient-tri font-bold text-primary-foreground shadow-cobalt" : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`;
        return onModuleChange && id ? <Button asChild variant="ghost" key={label} className={classes}><Link to="/dashboard" search={{ module: id }} aria-current={selected ? "page" : undefined} onClick={() => setOpen(false)}><Icon className="shrink-0" /><span>{label}</span></Link></Button> : <Button variant="ghost" key={label} className={classes} onClick={() => { setActive(label); setOpen(false); }}><Icon /><span>{label}</span></Button>;
      })}</div>)}
    </nav>
    <div className="shrink-0 border-t border-border px-4 py-4">
      <div className="mb-4 border-l-2 border-cyan pl-3"><p className="text-[11px] font-bold">Powering your bigger business tomorrow.</p><p className="mt-1 text-[10px] text-cyan">Simple. Secure. Global.</p></div>
      <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-xs font-black text-primary-foreground">{initials}</span><div className="min-w-0"><div className="truncate text-xs font-bold">{isBiz ? "Acme Logistics Ltd" : name}</div>{isBiz && <div className="truncate text-[10px] text-muted-foreground">{name} · Director</div>}</div></div>
      <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/auth" }); }} className="mt-2 w-full justify-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LogOut />Sign Out</Button>
    </div>
  </aside>;
  return <div className={`theme-flame relative flex min-h-screen bg-mesh ${isBiz ? "merchant-console" : ""}`}>
    <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</div>
    {open && <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}><div role="dialog" aria-modal="true" aria-label="Navigation menu" className="h-full w-[260px]" onClick={(e) => e.stopPropagation()}>{sidebar}</div></div>}
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex h-[72px] items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur-2xl md:gap-4 md:px-7">
        <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></Button>
        {greeting && <h1 className="hidden text-lg font-black xl:block">{greeting}</h1>}
        <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Global search" className="field h-10 pl-9 text-xs" placeholder={isBiz ? "Search transactions, customers, payments, or reference..." : "Search transactions..."} value={onSearchChange ? search : undefined} onChange={(e) => onSearchChange?.(e.target.value)} /></label>
        <div className="relative hidden sm:block"><Button variant="crisp" size="sm" onClick={() => { setCurrencies(!currencies); setSwitcher(false); setNotifications(false); }} aria-expanded={currencies}> {currency === "NGN" ? "🇳🇬 NGN (₦)" : currency}<ChevronDown /></Button>{currencies && <div className="merchant-popover absolute right-0 mt-3 w-40 rounded-lg border border-border bg-background p-2 shadow-cobalt">{["NGN", "KES", "GHS", "ZAR", "USD", "EUR", "GBP", "USDT"].map((c) => <Button key={c} variant="ghost" className="w-full justify-between" onClick={() => { setCurrency(c); setCurrencies(false); }}>{c}{c === currency && <Check />}</Button>)}</div>}</div>
        <div className="relative shrink-0"><Button variant="crisp" size="sm" onClick={() => { setSwitcher(!switcher); setCurrencies(false); setNotifications(false); }} aria-expanded={switcher} aria-label="Environment menu"><span className={`h-1.5 w-1.5 rounded-full motion-safe:animate-pulse ${environment === "Live Mode" ? "bg-success" : "bg-chart-4"}`} /><span className="hidden md:inline">{environment}</span><ChevronDown /></Button>{switcher && <div className="merchant-popover absolute right-0 mt-3 w-52 rounded-lg border border-border bg-background p-2 shadow-cobalt">{["Live Mode", "Test Sandbox"].map((e) => <Button key={e} variant="ghost" className="w-full justify-between text-xs" onClick={() => { setEnvironment(e); setSwitcher(false); }}>{e}{e === environment && <Check />}</Button>)}<div className="my-1 border-t border-border" /><Button variant="ghost" className="w-full justify-start text-xs" onClick={() => goMode(isBiz ? "personal" : "merchant")}>{isBiz ? "Personal Wallet" : "Business Console"}</Button></div>}</div>
        <div className="relative shrink-0"><Button variant="ghost" size="icon" aria-label="Notifications" aria-expanded={notifications} onClick={() => { setNotifications(!notifications); setSwitcher(false); setCurrencies(false); }}><Bell />{unread && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-magenta" />}</Button>{notifications && <div className="merchant-popover absolute right-0 mt-3 w-[min(300px,85vw)] rounded-lg border border-border bg-background p-5 shadow-cobalt"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Notifications</h2><Button variant="ghost" size="sm" onClick={() => setUnread(false)}>Mark read</Button></div><p className="mt-4 text-xs text-muted-foreground">Slikpay workspace is ready. Live notifications will appear when your service is connected.</p></div>}</div>
      </header>
      {environment === "Test Sandbox" && <div className="border-b border-chart-4/30 bg-chart-4/10 px-7 py-2 text-xs text-foreground">Test Sandbox selected · environment switching is preview-only; no requests are rerouted.</div>}
      {currency !== "NGN" && <div className="border-b border-border px-7 py-2 text-xs text-muted-foreground">{currency} selected · settlement balances remain denominated in NGN.</div>}
      <main className="space-y-5 p-4 md:p-7">{children}</main>
    </div>
  </div>;
}
export function ViewAll() { return <Link to="/dashboard" search={{ module: "transactions" }} className="text-sm font-bold text-cobalt hover:underline">View all →</Link>; }
