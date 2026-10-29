import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Check, Clock, Download, Fingerprint, History, KeyRound, Loader2, LockKeyhole, LogOut, Mail, Plus, RefreshCw, Search, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTeamSecurity, saveDisplayName, changeTransactionPin, sendTeamInvitation, revokeTeamInvitation } from "@/lib/team-security.functions";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { changePinSchema, invitationRoles, invitationRoleLabel, invitationRoleSchema } from "@/lib/team-security";
import { BrandSelect } from "./BrandSelect";
import securityArt from "@/assets/team-studio-lock.png";

type Data = Awaited<ReturnType<typeof getTeamSecurity>>;
type Action = "invite" | "pin" | "password" | "revoke" | "sessions" | "authenticator" | null;
export function TeamSecurity() {
  const get = useServerFn(getTeamSecurity);
  const save = useServerFn(saveDisplayName);
  const changePin = useServerFn(changeTransactionPin);
  const invite = useServerFn(sendTeamInvitation);
  const revoke = useServerFn(revokeTeamInvitation);
  const auth = useAuth(); const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [enrolment, setEnrolment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [search, setSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [inviteFilter, setInviteFilter] = useState("all");
  const submitting = useRef(false);
  const load = async () => {
    setLoading(true); setLoadError("");
    try { const d = await get(); setData(d); setName(d.owner.name); }
    catch { setLoadError("Account settings couldn’t be loaded. Sign in and try again."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const open = (next: Action, id?: string) => { setForm(next === "invite" ? { role: "viewer" } : {}); setError(""); setEnrolment(null); setSelected(id ?? null); setAction(next); };
  const close = async () => {
    if (busy) return;
    if (enrolment) await supabase.auth.mfa.unenroll({ factorId: enrolment.id });
    setEnrolment(null); setForm({}); setError(""); setAction(null);
  };
  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const field = (key: string, label: string, type = "text", max = 120) => <div><label htmlFor={`security-${key}`} className="text-xs font-bold">{label}</label><Input id={`security-${key}`} className="mt-2 h-11" type={type} maxLength={max} inputMode={key.toLowerCase().includes("pin") || key === "code" ? "numeric" : undefined} autoComplete={type === "password" ? "off" : undefined} value={form[key] ?? ""} onChange={(e) => update(key, key.toLowerCase().includes("pin") || key === "code" ? e.target.value.replace(/\D/g, "") : e.target.value)} required /></div>;
  const reauthenticate = async () => {
    if (!auth.user?.email || !form["currentPassword"]) throw new Error("Enter your current password.");
    const r = await supabase.auth.signInWithPassword({ email: auth.user.email, password: form["currentPassword"] });
    if (r.error) throw new Error("Your current password could not be confirmed.");
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) throw new Error("Authenticator status could not be checked.");
    const factor = factors.data.totp.find((f) => f.status === "verified");
    if (factor) {
      if (!/^\d{6}$/.test(form["code"] ?? "")) throw new Error("Enter the current 6-digit authenticator code.");
      const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: form["code"] ?? "" });
      if (verified.error) throw new Error("Authenticator code could not be verified.");
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (submitting.current) return; submitting.current = true; setBusy(true); setError("");
    try {
      if (action === "invite") {
        await invite({ data: { name: form["name"] ?? "", email: form["email"] ?? "", role: invitationRoleSchema.parse(form["role"] ?? "viewer"), pin: form["pin"] ?? "" } });
        toast.success("Invitation notice sent — no banking access granted");
      } else if (action === "pin") {
        if (form["newPin"] !== form["confirmPin"]) throw new Error("The new PINs do not match.");
        const parsed = changePinSchema.safeParse({ currentPin: form["currentPin"], newPin: form["newPin"] });
        if (!parsed.success) throw new Error("Enter two different 4-digit PINs.");
        await changePin({ data: parsed.data }); toast.success("Transaction PIN changed");
      } else if (action === "revoke") {
        if (!selected) return;
        await revoke({ data: { id: selected, pin: form["pin"] ?? "" } }); toast.success("Invitation revoked");
      } else if (action === "password") {
        if ((form["newPassword"] ?? "").length < 8 || (form["newPassword"] ?? "").length > 128) throw new Error("Use a password with 8–128 characters.");
        if (form["newPassword"] !== form["confirmPassword"]) throw new Error("The new passwords do not match.");
        await reauthenticate();
        const r = await supabase.auth.updateUser({ password: form["newPassword"] ?? "" });
        if (r.error) throw new Error("Password could not be changed. Check the account password requirements.");
        toast.success("Password changed");
      } else if (action === "sessions") {
        await reauthenticate(); const r = await supabase.auth.signOut({ scope: "others" });
        if (r.error) throw new Error("Other sessions could not be signed out.");
        toast.success("Other sessions signed out");
      } else if (action === "authenticator") {
        if (!enrolment) {
          const r = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Slikpay Authenticator" });
          if (r.error) throw new Error("Authenticator setup could not start. Check account availability.");
          setEnrolment({ id: r.data.id, qr: r.data.totp.qr_code, secret: r.data.totp.secret }); return;
        }
        const r = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolment.id, code: form["code"] ?? "" });
        if (r.error) throw new Error("That code did not match. Enter the current authenticator code.");
        setEnrolment(null); toast.success("Authenticator connected");
      }
      setAction(null); setForm({}); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "This action could not be completed."); }
    finally { submitting.current = false; setBusy(false); }
  };

  const status = (v: boolean | null | undefined) => v == null ? "Unverified" : v ? "Configured" : "Not configured";
  const rows = data?.invites.filter((r) => `${r.name} ${r.email} ${invitationRoleLabel(r.role)}`.toLowerCase().includes(search.toLowerCase()) && (inviteFilter === "all" || r.status === inviteFilter)) ?? [];
  const events = data?.events.filter((r) => r.action.toLowerCase().includes(activitySearch.toLowerCase())) ?? [];
  const pending = data?.invites.filter((r) => r.status === "pending").length;
  const exportActivity = () => {
    if (!data?.auditConnected) return;
    const csv = ["Event,Date", ...events.map((r) => [r.action, r.at].map((v) => `"${v.replace(/"/g, '""')}"`).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "slikpay-security-activity.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return <section className="grid min-w-0 items-start gap-0 bg-card lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)]">
    <aside className="team-studio-rail flex min-w-0 flex-col gap-6 p-6 lg:min-h-[740px] lg:p-7">
      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Team & Security</p><h2 className="mt-4 text-3xl font-extrabold leading-tight">Your trusted circle</h2><p className="mt-3 text-xs leading-6 text-muted-foreground">{data?.owner.company || "Your business account"}</p></div>
      <img src={securityArt} width={816} height={816} alt="Cyan security lock and blue key" className="mx-auto hidden aspect-square w-44 object-contain sm:block lg:w-full" />
      <dl className="grid grid-cols-2 gap-5 lg:grid-cols-1"><div className="flex items-start gap-3"><Users className="mt-1 h-5 w-5 shrink-0 text-cyan" /><div><dt className="text-sm font-bold">{data ? "1 Owner" : "Owner unverified"}</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">Owner-controlled account</dd></div></div><div className="flex items-start gap-3"><Mail className="mt-1 h-5 w-5 shrink-0 text-cyan" /><div><dt className="text-sm font-bold">7 Invitation roles</dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">{pending == null ? "Invitations unverified" : `${pending} pending invitations`}</dd></div></div></dl>
      <div className="flex items-start gap-3 border-l-2 border-magenta bg-magenta/10 p-4"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-magenta" /><div><p className="text-xs font-bold">Requested roles only</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Invitations do not grant shared workspace or banking access.</p></div></div>
      <div className="mt-auto hidden space-y-3 border-t border-border pt-5 lg:block">{[{ label: "Authenticator", value: status(data?.authenticator), Icon: Fingerprint }, { label: "Transaction PIN", value: status(data?.pinConfigured), Icon: KeyRound }].map(({ label, value, Icon }) => <div key={label} className="flex items-center gap-3"><Icon className="h-4 w-4 text-cyan" /><div><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div></div>)}</div>
    </aside>
    <div className="min-w-0 p-4 sm:p-6 xl:p-8">
    {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-destructive bg-destructive/5 p-4"><p className="text-sm text-destructive">{loadError}</p><Button variant="outline" onClick={load}><RefreshCw />Retry</Button></div>}
    <Tabs defaultValue="team" className="min-w-0">
      <TabsList className="mb-7 grid h-auto w-full grid-cols-4 gap-1 rounded-none border-b border-border bg-transparent p-0">{[{ id: "team", label: "Team", Icon: Users }, { id: "security", label: "Security", Icon: ShieldCheck }, { id: "profile", label: "Profile", Icon: UserRound }, { id: "activity", label: "Activity", Icon: History }].map(({ id, label, Icon }) => <TabsTrigger key={id} value={id} className="min-w-0 gap-2 rounded-none border-b-2 border-transparent px-1 py-3 text-xs shadow-none sm:text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"><Icon className="hidden h-4 w-4 sm:block" />{label}</TabsTrigger>)}</TabsList>
      <TabsContent value="team" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">People & invitations</h3><p className="mt-1 text-xs text-muted-foreground">Your business, your trusted circle.</p></div><Button variant="brand" disabled={!data?.teamConnected || loading} onClick={() => open("invite")}><Plus />Invite a colleague</Button></div>
        {data && <div className="flex flex-wrap items-center gap-4 border-y border-border py-4"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><UserRound /></span><div className="min-w-0 flex-1"><p className="font-bold">{data.owner.name || "Account owner"}</p><p className="break-all text-xs text-muted-foreground">{data.owner.email}</p></div><span className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-xs font-semibold text-success"><Check className="h-4 w-4" />Owner</span></div>}
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search team invitations" className="h-11 pl-10" placeholder="Search people, email or role" value={search} onChange={(e) => setSearch(e.target.value)} /></div><BrandSelect label="Invitation status" value={inviteFilter} onChange={setInviteFilter} options={[{ value: "all", label: "All invitations" }, { value: "pending", label: "Pending" }, { value: "expired", label: "Expired" }, { value: "delivery_failed", label: "Delivery unconfirmed" }, { value: "revoked", label: "Revoked" }]} /></div>
        {data && !data.teamConnected ? <p className="text-sm text-muted-foreground">Team invitation setup needs updating before invitations can be sent. Existing account security remains available.</p> : loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading team…</p> : rows.length ? <ul className="divide-y divide-border">{rows.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-3 py-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-magenta/10 text-magenta"><Mail className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{r.name}</p><p className="break-all text-xs text-muted-foreground">{r.email}</p><p className="mt-2 text-xs font-semibold text-primary">{invitationRoleLabel(r.role)} · Requested</p></div><div className="text-right"><span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-body">{r.status === "delivery_failed" ? "Delivery unconfirmed" : r.status.replace(/_/g, " ")}</span><p className="mt-2 text-[10px] text-muted-foreground">Expires {new Date(r.expiresAt).toLocaleDateString()}</p></div>{r.status !== "revoked" && <Button variant="ghost" size="icon" title="Revoke invitation" aria-label={`Revoke invitation for ${r.email}`} onClick={() => open("revoke", r.id)}><X /></Button>}{["expired", "delivery_failed", "revoked"].includes(r.status) && <Button variant="outline" size="sm" onClick={() => { open("invite"); setForm({ name: r.name, email: r.email, role: invitationRoleSchema.safeParse(r.role).success ? r.role : "viewer" }); }}><RefreshCw />Resend</Button>}</li>)}</ul> : <div className="py-9 text-center"><Mail className="mx-auto h-8 w-8 text-magenta" /><p className="mt-3 text-sm font-bold">{search || inviteFilter !== "all" ? "No matching invitations" : "Your team starts here"}</p><p className="mt-2 text-xs text-muted-foreground">{search || inviteFilter !== "all" ? "Try another name or status." : "No invitations yet."}</p></div>}
      </TabsContent>
      <TabsContent value="security" className="space-y-6">
        <div><h3 className="text-xl font-bold">Sign-in & payment protection</h3><p className="mt-1 text-xs text-muted-foreground">Keep your identity and money protected.</p></div>
        <div className="grid gap-4 md:grid-cols-2">{[
          { Icon: Fingerprint, title: "Authenticator app", detail: status(data?.authenticator), action: data?.authenticator ? null : "authenticator" as Action, button: "Set up", tone: "bg-primary/10 text-primary", accent: "border-t-primary" },
          { Icon: KeyRound, title: "Transaction PIN", detail: status(data?.pinConfigured), action: "pin" as Action, button: "Change PIN", tone: "bg-magenta/10 text-magenta", accent: "border-t-magenta" },
          { Icon: LockKeyhole, title: "Password", detail: "Current password required for changes", action: "password" as Action, button: "Change password", tone: "bg-success-soft text-success", accent: "border-t-success" },
          { Icon: LogOut, title: "Other sessions", detail: "Sign out other sessions; existing access tokens expire normally", action: "sessions" as Action, button: "Sign out others", tone: "bg-primary/10 text-primary", accent: "border-t-cyan" },
        ].map(({ Icon, title, detail, action, button, tone, accent }) => <div key={title} className={`flex min-w-0 flex-col items-start rounded-lg border border-t-2 bg-card p-5 ${accent}`}><span className={`flex h-11 w-11 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span><h4 className="mt-4 font-bold">{title}</h4><p className="mb-5 mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>{action ? <Button className="mt-auto" variant="outline" disabled={!data || loading || action === "pin" && !data?.auditConnected} onClick={() => open(action)}>{button}<ArrowUpRight className="h-4 w-4" /></Button> : <span className="mt-auto flex items-center gap-2 text-xs font-semibold text-success"><Check className="h-4 w-4" />Connected</span>}</div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><div><h4 className="text-sm font-bold">This device</h4><p className="mt-1 text-xs text-muted-foreground">End your current Slikpay session.</p></div><Button variant="outline" onClick={async () => { await auth.signOut(); await navigate({ to: "/auth", replace: true }); }}><LogOut />Sign out this device</Button></div>
      </TabsContent>
      <TabsContent value="profile" className="space-y-6"><div><h3 className="text-xl font-bold">Business profile</h3><p className="mt-1 text-xs text-muted-foreground">Your identity at the heart of your business.</p></div><div className="flex items-center gap-4 border-b border-border bg-tint-magenta px-4 py-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-magenta/10 text-magenta"><UserRound className="h-7 w-7" /></span><div className="min-w-0"><p className="break-words font-bold">{data?.owner.company || "Business account"}</p><p className="mt-1 text-xs text-muted-foreground">Account owner profile</p></div></div><div className="grid gap-7 lg:grid-cols-2"><form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (busy) return; setBusy(true); try { await save({ data: { name } }); toast.success("Name saved"); await load(); await auth.refresh(); } catch { toast.error("Name could not be saved or confirmed. Refresh before retrying."); } finally { setBusy(false); } }}><h4 className="flex items-center gap-2 text-sm font-bold"><UserRound className="h-4 w-4 text-primary" />Personal details</h4><div><label htmlFor="profile-name" className="text-xs font-bold">Display name</label><Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} className="mt-2 h-11" required /></div><Button variant="brand" disabled={busy || !data?.auditConnected || name.trim() === data?.owner.name}>{busy ? <Loader2 className="animate-spin" /> : <Check />}Save changes</Button></form><div><h4 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-success" />Registered details</h4><dl className="mt-4 divide-y divide-border">{[["Registered business", data?.owner.company], ["Registration number", data?.owner.registration], ["Account email", data?.owner.email]].map(([label, value]) => <div key={label} className="py-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3 w-3" />{label}</dt><dd className="mt-2 break-words text-sm font-semibold">{value || "—"}</dd></div>)}</dl></div></div></TabsContent>
      <TabsContent value="activity" className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">Security activity</h3><p className="mt-1 text-xs text-muted-foreground">{data?.auditConnected ? `${data.events.length} recent recorded changes` : "Account change history"}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!data?.auditConnected || !events.length} onClick={exportActivity}><Download />Export</Button><Button variant="outline" size="icon" title="Refresh activity" aria-label="Refresh security activity" disabled={loading} onClick={load}><RefreshCw className={loading ? "animate-spin" : ""} /></Button></div></div><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search security activity" placeholder="Search account changes" className="h-11 pl-10" value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} /></div>{data?.auditConnected ? events.length ? <ul>{events.map((r) => <li key={r.id} className="flex items-start gap-4 border-b border-border py-5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${r.action.toLowerCase().includes("invitation") ? "bg-magenta/10 text-magenta" : "bg-success-soft text-success"}`}><History className="h-5 w-5" /></span><div className="min-w-0"><p className="break-words text-sm font-semibold">{r.action}</p><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{new Date(r.at).toLocaleString()}</p></div></li>)}</ul> : <div className="py-9 text-center"><History className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 text-sm font-semibold">{activitySearch ? "No matching activity" : "No recorded security changes yet"}</p></div> : <p className="border-l-2 border-primary bg-primary/5 p-4 text-sm text-muted-foreground">Security activity storage is not connected yet.</p>}<p className="flex items-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole className="h-3 w-3" />Account changes only · Not a complete sign-in or device history</p></TabsContent>
    </Tabs>
    </div>
    <Dialog open={action !== null} onOpenChange={(o) => !o && void close()}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{action === "invite" ? "Invite a colleague" : action === "pin" ? "Change transaction PIN" : action === "password" ? "Change password" : action === "revoke" ? "Revoke invitation" : action === "sessions" ? "Sign out other sessions" : "Connect authenticator"}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4">
      {action === "invite" && <>{field("name", "Full name")}{field("email", "Work email", "email", 254)}<div><p className="mb-2 text-xs font-bold">Requested role</p><BrandSelect label="Requested role" value={form["role"] ?? "viewer"} onChange={(v) => update("role", v)} options={invitationRoles.map((r) => ({ value: r.value, label: r.label }))} /><p className="mt-2 text-xs text-muted-foreground">{invitationRoles.find((r) => r.value === (form["role"] ?? "viewer"))?.description} · Not yet active</p></div>{field("pin", "Transaction PIN", "password", 4)}<p className="text-xs text-muted-foreground">This sends a pending invitation notice. It grants no account or payment access.</p></>}
      {action === "pin" && <>{field("currentPin", "Current PIN", "password", 4)}{field("newPin", "New PIN", "password", 4)}{field("confirmPin", "Confirm new PIN", "password", 4)}</>}
      {(action === "password" || action === "sessions") && <>{field("currentPassword", "Current password", "password", 128)}{data?.authenticator && field("code", "Authenticator code", "text", 6)}{action === "password" && <>{field("newPassword", "New password", "password", 128)}{field("confirmPassword", "Confirm new password", "password", 128)}</>}</>}
      {action === "revoke" && field("pin", "Transaction PIN", "password", 4)}
      {action === "authenticator" && enrolment && <><img src={enrolment.qr} width={180} height={180} alt="Scan with your authenticator" className="mx-auto" /><p className="break-all font-mono text-xs text-muted-foreground">Setup key: {enrolment.secret}</p>{field("code", "Authenticator code", "text", 6)}</>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" variant="brand" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{action === "authenticator" && !enrolment ? "Start setup" : "Confirm"}</Button>
    </form></DialogContent></Dialog>
  </section>;
}