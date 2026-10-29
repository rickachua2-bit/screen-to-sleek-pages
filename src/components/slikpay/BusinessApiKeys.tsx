import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BookOpen, Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listBusinessKeys, manageBusinessKey, startKeyEmailCode } from "@/lib/business-keys.functions";
import { API_PATHS, DOCS_SECTIONS, DOCS_URL, docsLink } from "@/lib/business-api";
type Key = Awaited<ReturnType<typeof listBusinessKeys>>[number];
export function BusinessApiKeys({ compact = false }: { compact?: boolean }) {
  const load = useServerFn(listBusinessKeys);
  const manage = useServerFn(manageBusinessKey);
  const sendCode = useServerFn(startKeyEmailCode);
  const [challenge, setChallenge] = useState<{ challengeId: string; email: string } | null>(null);
  const [sending, setSending] = useState(false);
  async function requestCode() { if (sending) return; setSending(true); try { setChallenge(await sendCode()); toast.success("Code sent to your email"); } catch { toast.error("We couldn't send the email code. Try again shortly."); } finally { setSending(false); } }
  function open(key: Key, action: "claim" | "rotate" | "revoke") { setPin(""); setChallenge(null); setSelected({ key, action }); }
  const [keys, setKeys] = useState<Key[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ key: Key; action: "claim" | "rotate" | "revoke" } | null>(null);
  const [pin, setPin] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const lock = useRef(false);
  async function refresh() { try { setKeys(await load()); setError(""); } catch { setError("Business key issuance is awaiting account service activation."); } }
  useEffect(() => { void refresh(); }, [load]);
  useEffect(() => { if (!secret) return; const timer = setTimeout(() => setSecret(null), 60000); return () => clearTimeout(timer); }, [secret]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!selected || lock.current) return;
    lock.current = true; setBusy(true);
    try { const result = await manage({ data: { id: selected.key.id, action: selected.action, challengeId: challenge?.challengeId ?? "", code: pin } }); setSecret(result.secret); setSelected(null); setPin(""); setChallenge(null); await refresh(); if (!result.secret) toast.success("Key revoked"); }
    catch { toast.error("Key action could not be completed. Check the email code and refresh before trying again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={`space-y-5 ${compact ? "mission-keys-compact" : "mission-keys"}`}><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className={`${compact ? "text-base" : "text-2xl"} font-bold`}>{compact ? "Your API keys" : "API keys and access"}</h2><p className="mt-2 text-xs text-muted-foreground">Sandbox at signup · live after KYB approval</p></div><Button variant="ghost" size="icon" title="Refresh API keys" aria-label="Refresh API keys" onClick={() => void refresh()}><RefreshCw /></Button></header>
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {secret && <div className="border border-primary/30 bg-primary/5 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Save your secret key now</h3><Button variant="ghost" size="icon" aria-label="Dismiss secret" onClick={() => setSecret(null)}><X /></Button></div><p className="my-3 text-xs text-muted-foreground">Shown once. This display closes after one minute. Keep it on your server, never in browser code.</p><div className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all text-xs">{secret}</code><Button variant="outline" size="icon" aria-label="Copy secret key" onClick={() => { void navigator.clipboard.writeText(secret).then(() => toast.success("Key copied")).catch(() => toast.error("Copy unavailable")); }}><Copy /></Button></div></div>}
    <div className="mission-key-list">{["sandbox", "live"].map((mode) => { const key = keys.find((k) => k.mode === mode && !k.revoked_at) ?? keys.find((k) => k.mode === mode); return <article key={mode} className="mission-key-row"><span className={`rounded-md p-2.5 ${mode === "live" ? "text-magenta bg-magenta/10" : "text-primary bg-primary/10"}`}><KeyRound className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-xs font-bold">{mode === "live" ? "Live" : "Sandbox"} secret key</h3><p className="mt-1 text-[11px] text-muted-foreground">{key ? key.revoked_at ? "Revoked" : new Date(key.expires_at) <= new Date() ? "Expired" : key.claimed_at ? "Active · secret already claimed" : "Issued · ready to claim" : error ? "Activation required" : mode === "live" ? "Available after approved KYB" : "No key recorded"}</p>{key && <p className="mt-2 text-[10px] text-muted-foreground">Expires {new Date(key.expires_at).toLocaleDateString()} · {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleString()}` : "Not used yet"}</p>}</div>{key && <div className="flex gap-1">{!key.claimed_at && !key.revoked_at && <Button variant="outline" size="sm" onClick={() => open(key, "claim")}><KeyRound />Claim once</Button>}<Button variant="outline" size="icon" title="Rotate key; revoke the old key immediately" aria-label={`Rotate ${mode} key`} onClick={() => open(key, "rotate")}><RefreshCw /></Button>{!key.revoked_at && <Button variant="ghost" size="icon" title="Revoke key" aria-label={`Revoke ${mode} key`} onClick={() => open(key, "revoke")}><Trash2 className="text-destructive" /></Button>}</div>}</article>; })}</div>
    {!compact && <div className="grid gap-4 border-y border-border py-5 sm:grid-cols-3">{[{ name: "Permissions", value: "Balances, receipts and banks · read only" }, { name: "Protection", value: "Email-code confirmation for reveal, rotation and revocation" }, { name: "Limits", value: "60 requests/minute per key · 365-day expiry" }].map((v) => <div key={v.name}><ShieldCheck className="mb-3 size-5 text-primary" /><p className="text-sm font-semibold">{v.name}</p><p className="mt-2 text-xs text-muted-foreground">{v.value}</p></div>)}</div>}
    {compact && <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" />Email-code confirmation · read-only access</p>}
    <p className="text-xs text-muted-foreground">Payment execution and outbound subscriptions are not enabled by these read-only keys.</p>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"><form className="slik-popup w-full max-w-md p-6 space-y-4" role="dialog" aria-modal="true" aria-label="Confirm key action" onSubmit={submit}><div className="flex items-center justify-between"><h3 className="font-bold">{selected.action === "claim" ? "Claim secret once" : selected.action === "rotate" ? "Rotate secret key" : "Revoke secret key"}</h3><Button type="button" variant="ghost" size="icon" disabled={busy} aria-label="Close key action" onClick={() => setSelected(null)}><X /></Button></div><p className="text-xs text-muted-foreground">{selected.action === "rotate" ? "The old key stops working immediately. Update your integration with the replacement." : selected.action === "revoke" ? "Your integration loses access immediately." : "The secret cannot be displayed again. Rotate it if you lose it."}</p>{!challenge ? <Button type="button" className="w-full" disabled={sending} onClick={() => void requestCode()}>{sending && <Loader2 className="animate-spin" />}Email me a code</Button> : <><p className="text-xs text-muted-foreground">Enter the 6-digit code sent to {challenge.email}.</p><Button type="button" variant="link" className="h-auto px-0" disabled={sending} onClick={() => void requestCode()}>Resend code</Button><label className="block text-sm">Email code<input type="text" className="field mt-2 w-full tracking-[0.4em]" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g,""))} /></label></>}<Button className="w-full" disabled={busy || !challenge || pin.length !== 6}>{busy && <Loader2 className="animate-spin" />}Confirm</Button></form></div>}
  </section>;
}
export function BusinessApiDocs() {
  return <section className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold">Business API reference</h2><p className="mt-2 text-sm text-muted-foreground">GET requests use Authorization: Bearer &lt;your business secret key&gt;.</p></div>
      <Button asChild variant="brand" className="shine bg-gradient-tri"><a href={DOCS_URL} target="_blank" rel="noreferrer noopener">Open full documentation<ArrowUpRight /></a></Button>
    </header>
    <a href={DOCS_URL} target="_blank" rel="noreferrer noopener" className="developer-docs-hero flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-5 transition-colors hover:bg-primary/10">
      <span className="flex items-start gap-3"><BookOpen className="mt-0.5 size-5 shrink-0 text-primary" /><span><span className="block text-sm font-bold">Slikpay developer documentation</span><span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{DOCS_URL}</span></span></span>
      <span className="flex items-center gap-1.5 text-xs font-bold text-primary">Guides, endpoints, webhooks and error codes<ArrowUpRight className="size-4" /></span>
    </a>
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Jump to a guide</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{DOCS_SECTIONS.map((s) => <a key={s.id} href={docsLink(s.id)} target="_blank" rel="noreferrer noopener" className="developer-docs-link flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-primary/5"><span>{s.name}</span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></a>)}</div>
    </div>
    <div className="border-t border-border pt-2">{API_PATHS.map((e) => <div key={e.path} className="border-b border-border py-4"><p className="break-all font-mono text-xs text-primary">GET {e.path}</p><p className="mt-2 text-sm">{e.description}</p><p className="mt-2 text-xs text-muted-foreground">Scope: {e.scope}</p></div>)}</div>
    <p className="text-xs text-muted-foreground">401: inactive or invalid key · 429: rate limited (Retry-After) · 503: service unavailable. Receipts return the latest 50 records. Balances are owner-scoped account-ledger balances, not the shared platform wallet. No payment write endpoint is enabled. Full request formats, signing and troubleshooting live at <a className="font-semibold text-primary underline underline-offset-4" href={DOCS_URL} target="_blank" rel="noreferrer noopener">docs.slikpay.online</a>.</p>
  </section>;
}
