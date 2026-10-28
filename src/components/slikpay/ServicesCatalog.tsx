import { useState } from "react";
import * as Icons from "lucide-react";
import { ArrowRight, Search, Sparkles, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SERVICE_CATEGORIES, STATUS_LABEL, searchServices, serviceStatus, type ServiceDef } from "@/lib/services-registry";
import type { Mode, Role } from "@/lib/paddle-policy";
import moveImage from "@/assets/services-move.jpg";
import paidImage from "@/assets/services-paid.jpg";
import billsImage from "@/assets/services-bills.jpg";

const featured = [
  { category: "move", image: moveImage, description: "Bank transfers, international payments and currency exchange.", action: "Send money", service: "send" },
  { category: "paid", image: paidImage, description: "Payment links, invoices and ways to collect from customers.", action: "Explore payments", service: "links" },
  { category: "bills", image: billsImage, description: "Electricity, airtime, data, TV and everyday bill payments.", action: "Pay a bill", service: "power" },
];
const categoryIcons: Record<string, string> = { move: "ArrowLeftRight", paid: "BadgeCheck", bills: "Zap", cards: "CreditCard", grow: "TrendingUp", travel: "Plane", business: "BriefcaseBusiness", gov: "Landmark", dev: "Code2" };
function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Component = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Boxes;
  return <Component className={className} />;
}

export function ServicesCatalog({ items, ctx, title, favourites, recent, launch, toggleFavourite }: {
  items: ServiceDef[]; ctx: { role: Role; mode: Mode; review: string }; title?: string | undefined;
  favourites: string[]; recent: { id: string; label: string; at: string }[];
  launch: (service: ServiceDef) => void; toggleFavourite: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = SERVICE_CATEGORIES.filter((c) => items.some((s) => s.category === c.id));
  const results = searchServices(query, items).filter((s) => category === "all" || s.category === category);
  const filtered = Boolean(query.trim()) || category !== "all";
  const favs = items.filter((s) => favourites.includes(s.id));
  const suggestions = [{ id: "send", label: "Send money", icon: "Send" }, { id: "airtime", label: "Buy airtime", icon: "Phone" }, { id: "intl", label: "Send to Ghana", icon: "Globe" }, { id: "bulk", label: "Pay your team", icon: "Users" }];

  const serviceTile = (s: ServiceDef) => {
    const status = serviceStatus(s, ctx);
    const favourite = favourites.includes(s.id);
    const categoryLabel = SERVICE_CATEGORIES.find((c) => c.id === s.category)?.label;
    return <article key={s.id} className={`services-item service-tone-${s.category}`}>
      <Button variant="ghost" size="icon" className="services-star" onClick={() => toggleFavourite(s.id)} aria-label={`${favourite ? "Remove" : "Add"} ${s.label} ${favourite ? "from" : "to"} favourites`} aria-pressed={favourite}><Star className={favourite ? "fill-current text-cobalt" : ""} /></Button>
      <Button variant="ghost" className="services-item-main" onClick={() => launch(s)}>
        <span className="services-category-icon"><ServiceIcon name={s.icon} className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="services-item-category">{categoryLabel}</span><span className="block text-sm font-bold leading-5">{s.label}</span><span className={`services-status status-${status}`}>{STATUS_LABEL[status]}</span></span>
        <span className="services-open"><ArrowRight /></span>
      </Button>
    </article>;
  };

  return <section className="services-catalog space-y-6" aria-label="Banking services">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-extrabold">{title ?? "All banking services"}</h2><span className="text-xs font-semibold text-muted-foreground">{items.length} services</span></div>
    <div className="services-command px-5 py-6 md:px-7 md:py-7">
      <div className="flex items-center gap-3"><Sparkles className="h-7 w-7 shrink-0 text-cyan" /><h3 className="text-xl font-extrabold md:text-2xl">What do you want to do today?</h3></div>
      <form className="services-search mt-5 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (results.length === 1 && results[0]) launch(results[0]); }}>
        <Search className="ml-4 h-5 w-5 shrink-0 text-cyan" /><Input aria-label="Search services" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a service…" className="h-12 min-w-0 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
        {query && <Button type="button" variant="ghost" size="icon" onClick={() => setQuery("")} aria-label="Clear search"><X /></Button>}
        <Button type="submit" size="icon" className="services-search-submit m-1 shrink-0 rounded-full" aria-label="Find services"><ArrowRight /></Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">{suggestions.map((suggestion) => { const service = items.find((s) => s.id === suggestion.id); return service ? <Button key={service.id} variant="ghost" size="sm" className="services-suggestion rounded-full" onClick={() => launch(service)}><ServiceIcon name={suggestion.icon} />{suggestion.label}<Icons.ChevronRight className="opacity-50" /></Button> : null; })}</div>
    </div>

    {!filtered && <>
      {recent.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-semibold text-muted-foreground">Recent</span>{recent.map((r) => { const s = items.find((item) => item.id === r.id); return s ? <Button key={r.at} variant="outline" size="sm" className="rounded-full" onClick={() => launch(s)}><Icons.History />{r.label}</Button> : null; })}</div>}
      {favs.length > 0 && <div><h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Star className="h-4 w-4 text-cobalt" />Favourites</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{favs.map(serviceTile)}</div></div>}
      <div className="grid gap-5 md:grid-cols-3">{featured.map((feature) => { const c = categories.find((cat) => cat.id === feature.category); const list = items.filter((s) => s.category === feature.category); if (!c) return null; const primary = list.find((s) => s.id === feature.service) ?? list[0]; if (!primary) return null;
        return <article key={c.id} className="services-feature"><img src={feature.image} alt={`${c.label} illustration`} width={1152} height={576} loading="lazy" className="aspect-[2/1] w-full object-cover" /><div className="flex flex-1 flex-col p-5"><h3 className="text-xl font-extrabold">{c.label}</h3><p className="mt-2 min-h-10 text-sm leading-5 text-body">{feature.description}</p><Button variant="brand" className="mt-4 w-fit rounded-full" onClick={() => launch(primary)}>{feature.action}<ArrowRight /></Button><div className="services-feature-links mt-5 flex flex-wrap gap-x-3 gap-y-2 pt-3">{list.slice(0, 3).map((s) => <Button key={s.id} variant="link" className="h-auto whitespace-normal p-0 text-left text-[11px] text-muted-foreground" onClick={() => launch(s)}><ServiceIcon name={s.icon} />{s.label}</Button>)}</div></div></article>;
      })}</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categories.filter((c) => !featured.some((f) => f.category === c.id)).map((c) => <article key={c.id} className={`services-category service-tone-${c.id}`}><span className="services-category-icon h-14 w-14 shrink-0"><ServiceIcon name={categoryIcons[c.id] ?? "Boxes"} className="h-7 w-7" /></span><div className="min-w-0"><h3 className="text-base font-extrabold">{c.label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{c.blurb}</p><Button variant="link" className="mt-2 h-auto p-0 text-xs font-bold text-cobalt" onClick={() => setCategory(c.id)}>Explore {c.label.toLowerCase()}<ArrowRight /></Button></div></article>)}</div>
    </>}

    <div className="services-browse space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="services-browse-symbol"><Icons.LayoutGrid className="h-5 w-5" /></span><h3 className="text-lg font-extrabold">{filtered ? "Matching services" : "Browse all services"}</h3><span className="services-count">{results.length}</span></div>{filtered && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setCategory("all"); }}><X />Clear filters</Button>}</div>
      <div className="flex flex-wrap gap-2" aria-label="Service categories"><Button variant="ghost" size="sm" className="services-filter service-tone-move" aria-pressed={category === "all"} onClick={() => setCategory("all")}><Icons.LayoutGrid />All</Button>{categories.map((c) => <Button key={c.id} variant="ghost" size="sm" className={`services-filter service-tone-${c.id}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}><ServiceIcon name={categoryIcons[c.id] ?? "Boxes"} />{c.label}</Button>)}</div>
      <div aria-live="polite">{results.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{results.map(serviceTile)}</div> : <div className="services-empty py-10 text-center"><Search className="mx-auto mb-3 h-6 w-6 text-cobalt" /><p className="font-bold">No matching services</p><p className="mt-1 text-sm text-muted-foreground">Try another service or clear your filters.</p></div>}</div>
    </div>
  </section>;
}