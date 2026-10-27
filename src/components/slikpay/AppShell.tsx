import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu, Search, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";
import { Logo } from "./Logo";

export interface NavItem { label: string; icon: LucideIcon }

export function AppShell({ mode, nav, children, greeting }: { mode: Role; nav: NavItem[]; children: ReactNode; greeting?: string }) {
  const { user, ready, token, signOut, setRole } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(nav[0]!.label);
  const [open, setOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);

  useEffect(() => {
    if (ready && !token) navigate({ to: "/auth" });
  }, [ready, token, navigate]);

  const name = user?.name ?? "Patrick Otu";
  const initials = user?.initials ?? "PO";
  const isBiz = mode === "merchant";

  const goMode = (r: Role) => {
    setRole(r);
    setSwitcher(false);
    navigate({ to: r === "merchant" ? "/dashboard" : "/personal" });
  };

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r-[1.5px] border-border bg-background p-4">
      <div className="mb-6 flex items-center justify-between px-2">
        <Logo sub={isBiz ? "Business · by Sterling Bank" : "Personal · by Sterling Bank"} />
        <button className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {nav.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => { setActive(label); setOpen(false); }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${active === label ? "bg-navy text-primary-foreground" : "text-body hover:bg-muted hover:text-foreground"}`}
          >
            <Icon className="h-[18px] w-[18px]" /> {label}
          </button>
        ))}
      </nav>
      <div className="relative mt-4 overflow-hidden rounded-2xl border-[1.5px] border-border p-4">
        <svg className="absolute -bottom-4 -right-4 h-14 w-24 opacity-40" viewBox="0 0 120 60" aria-hidden>
          <path d="M0 60 C40 10 80 50 120 0" className="stroke-cobalt" strokeWidth="6" fill="none" />
          <path d="M10 60 C50 20 85 55 120 15" className="stroke-magenta" strokeWidth="4" fill="none" />
          <path d="M20 60 C55 30 90 60 120 30" className="stroke-cyan" strokeWidth="3" fill="none" />
        </svg>
        <p className="relative text-sm font-black text-foreground">{isBiz ? "Powering your bigger business tomorrow." : "Banking that moves with you."}</p>
        <p className="relative mt-1 text-xs font-bold text-cobalt">Simple. Secure. Global.</p>
      </div>
      <div className="mt-4 flex items-center gap-3 border-t-[1.5px] border-border px-1 pt-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-sm font-black text-primary-foreground">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold text-foreground">{name}</div>
          <button onClick={() => { signOut(); navigate({ to: "/auth" }); }} className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-destructive">
            <LogOut className="h-3 w-3" /> Sign Out
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="theme-flame relative flex min-h-screen bg-background bg-mesh">
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 bg-obsidian/25 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-64" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b-[1.5px] border-border bg-background/95 px-4 py-3 backdrop-blur md:px-8">
          <button className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
          {greeting ? (
            <h1 className="hidden text-lg font-black text-foreground md:block">{greeting}</h1>
          ) : null}
          <label className="relative flex-1 md:max-w-md">
            <span className="sr-only">Search</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="field h-10 pl-9 text-sm" placeholder={isBiz ? "Search transactions, customers, or reference..." : "Search transactions..."} />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-xl border-2 border-border px-3 py-2 text-sm font-bold text-foreground sm:inline">🇳🇬 NGN (₦)</span>
            <div className="relative">
              <button onClick={() => setSwitcher(!switcher)} className="flex items-center gap-1.5 rounded-full border-2 border-border px-3 py-2 text-sm font-bold text-foreground hover:border-cobalt">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Live <ChevronDown className="h-4 w-4" />
              </button>
              {switcher && (
                <div className="panel absolute right-0 mt-2 w-52 p-1.5 shadow-xl">
                  {(["merchant", "personal"] as Role[]).map((r) => (
                    <button key={r} onClick={() => goMode(r)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${mode === r ? "bg-cobalt/10 text-cobalt" : "text-foreground hover:bg-muted"}`}>
                      Slikpay {r === "merchant" ? "Business" : "Personal"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-xs font-black text-primary-foreground">{initials}</span>
              <div className="leading-tight">
                <div className="text-sm font-extrabold text-foreground">{name}</div>
                <div className="text-[11px] font-semibold text-muted-foreground">{isBiz ? user?.title ?? "Executive Director" : "Personal account"}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="space-y-5 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function ViewAll() {
  return <Link to="/dashboard" className="text-sm font-bold text-cobalt hover:underline">View all →</Link>;
}
