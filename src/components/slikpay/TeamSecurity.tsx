import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Check, Clock, Fingerprint, History, KeyRound, Loader2, LockKeyhole, LogOut, Mail, Plus, RefreshCw, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTeamSecurity, saveDisplayName, changeTransactionPin, sendTeamInvitation, revokeTeamInvitation } from "@/lib/team-security.functions";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { changePinSchema } from "@/lib/team-security";
import securityArt from "@/assets/team-security.jpg";

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
  const submitting = useRef(false);
  const load = async () => {
    setLoading(true); setLoadError("");
    try { const d = await get(); setData(d); setName(d.owner.name); }
    catch { setLoadError("Account settings couldn’t be loaded. Sign in and try again."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const open = (next: Action, id?: string) => { setForm({}); setError(""); setEnrolment(null); setSelected(id ?? null); setAction(next); };
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
        await invite({ data: { name: form["name"] ?? "", email: form["email"] ?? "", pin: form["pin"] ?? "" } });
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
  const rows = data?.invites.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <section className="min-w-0 space-y-7">
    <header className="grid items-center gap-6 border-b border-border pb-6 sm:grid-cols-[1fr_190px]">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase text-primary"><ShieldCheck className="h-4 w-4" />Account control</p><h2 className="mt-3 text-3xl font-extrabold">Team & Security</h2><p className="mt-3 break-words text-sm text-muted-foreground">{data?.owner.company || "Your business account"}</p><div className="mt-4 flex flex-wrap gap-4 text-xs"><span className="flex items-center gap-2 text-success"><LockKeyhole className="h-4 w-4" />Owner-controlled settings</span><span className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4 text-primary" />{data ? "1 account owner" : "Owner status unverified"}</span></div></div>
      <img src={securityArt} width={1024} height={768} alt="Team profiles and security key" className="hidden aspect-[4/3] w-full object-contain sm:block" />
    </header>
    {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-destructive bg-destructive/5 p-4"><p className="text-sm text-destructive">{loadError}</p><Button variant="outline" onClick={load}><RefreshCw />Retry</Button></div>}
    <Tabs defaultValue="team" className="min-w-0">
      <TabsList className="mb-5 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">{[{ id: "team", label: "Team", Icon: Users }, { id: "security", label: "Security", Icon: ShieldCheck }, { id: "profile", label: "Profile", Icon: UserRound }, { id: "activity", label: "Activity", Icon: History }].map(({ id, label, Icon }) => <TabsTrigger key={id} value={id} className="gap-2 py-2.5"><Icon className="h-4 w-4" />{label}</TabsTrigger>)}</TabsList>
      <TabsContent value="team" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><h3 className="text-lg font-bold">People & invitations</h3><Button variant="brand" disabled={!data?.teamConnected || loading} onClick={() => open("invite")}><Plus />Invite a colleague</Button></div>
        <p className="border-l-2 border-primary bg-primary/5 p-4 text-sm text-body">Invitations are pending notices only. Shared dashboard access, roles and payment permissions are not active.</p>
        {data && <div className="flex flex-wrap items-center gap-4 border-y border-border py-5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound /></span><div className="min-w-0 flex-1"><p className="font-bold">{data.owner.name || "Account owner"}</p><p className="break-all text-xs text-muted-foreground">{data.owner.email}</p></div><span className="flex items-center gap-2 text-xs font-semibold text-success"><Check className="h-4 w-4" />Owner</span></div>}
        <Input aria-label="Search team invitations" placeholder="Search people or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        {data && !data.teamConnected ? <p className="text-sm text-muted-foreground">Team invitation storage is not connected yet. Existing account security remains available.</p> : loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading team…</p> : rows.length ? <ul className="divide-y divide-border">{rows.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-3 py-4"><Mail className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{r.name}</p><p className="break-all text-xs text-muted-foreground">{r.email}</p></div><span className="text-xs text-muted-foreground">{r.status.replace(/_/g, " ")}</span>{r.status !== "revoked" && <Button variant="ghost" size="icon" aria-label={`Revoke invitation for ${r.email}`} onClick={() => open("revoke", r.id)}><X /></Button>}</li>)}</ul> : <p className="py-6 text-sm text-muted-foreground">No pending invitations.</p>}
      </TabsContent>
      <TabsContent value="security" className="space-y-6">
        <h3 className="text-lg font-bold">Sign-in & payment protection</h3>
        <div className="divide-y divide-border">{[
          { Icon: Fingerprint, title: "Authenticator app", detail: status(data?.authenticator), action: data?.authenticator ? null : "authenticator" as Action, button: "Set up" },
          { Icon: KeyRound, title: "Transaction PIN", detail: status(data?.pinConfigured), action: "pin" as Action, button: "Change PIN" },
          { Icon: LockKeyhole, title: "Password", detail: "Current password required for changes", action: "password" as Action, button: "Change password" },
          { Icon: LogOut, title: "Other sessions", detail: "Sign out other sessions; existing access tokens expire normally", action: "sessions" as Action, button: "Sign out others" },
        ].map(({ Icon, title, detail, action, button }) => <div key={title} className="flex flex-wrap items-center gap-4 py-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h4 className="font-bold">{title}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>{action && <Button variant="outline" disabled={!data || loading || action === "pin" && !data?.auditConnected} onClick={() => open(action)}>{button}</Button>}</div>)}</div>
        <Button variant="outline" onClick={async () => { await auth.signOut(); await navigate({ to: "/auth" }); }}><LogOut />Sign out this device</Button>
      </TabsContent>
      <TabsContent value="profile" className="space-y-5"><h3 className="text-lg font-bold">Business profile</h3><form className="max-w-lg space-y-4" onSubmit={async (e) => { e.preventDefault(); if (busy) return; setBusy(true); try { await save({ data: { name } }); toast.success("Name saved"); await load(); await auth.refresh(); } catch { toast.error("Name could not be saved or confirmed. Refresh before retrying."); } finally { setBusy(false); } }}><div><label htmlFor="profile-name" className="text-xs font-bold">Display name</label><Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} className="mt-2" required /></div><Button variant="brand" disabled={busy || !data?.auditConnected}>{busy && <Loader2 className="animate-spin" />}Save changes</Button></form><dl className="space-y-4 border-t border-border pt-5">{[["Verified business", data?.owner.company], ["Registration number", data?.owner.registration], ["Account email", data?.owner.email]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value || "—"}</dd></div>)}</dl></TabsContent>
      <TabsContent value="activity" className="space-y-5"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Security activity</h3><Button variant="ghost" size="icon" aria-label="Refresh security activity" disabled={loading} onClick={load}><RefreshCw /></Button></div>{data?.auditConnected ? data.events.length ? <ul className="divide-y divide-border">{data.events.map((r) => <li key={r.id} className="flex items-start gap-3 py-4"><Clock className="mt-1 h-4 w-4 text-primary" /><div><p className="text-sm font-semibold">{r.action}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</p></div></li>)}</ul> : <p className="text-sm text-muted-foreground">No recorded security changes yet.</p> : <p className="text-sm text-muted-foreground">Security activity storage is not connected yet.</p>}</TabsContent>
    </Tabs>
    <Dialog open={action !== null} onOpenChange={(o) => !o && void close()}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{action === "invite" ? "Invite a colleague" : action === "pin" ? "Change transaction PIN" : action === "password" ? "Change password" : action === "revoke" ? "Revoke invitation" : action === "sessions" ? "Sign out other sessions" : "Connect authenticator"}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4">
      {action === "invite" && <>{field("name", "Full name")}{field("email", "Work email", "email", 254)}{field("pin", "Transaction PIN", "password", 4)}<p className="text-xs text-muted-foreground">This sends a pending invitation notice. It grants no account or payment access.</p></>}
      {action === "pin" && <>{field("currentPin", "Current PIN", "password", 4)}{field("newPin", "New PIN", "password", 4)}{field("confirmPin", "Confirm new PIN", "password", 4)}</>}
      {(action === "password" || action === "sessions") && <>{field("currentPassword", "Current password", "password", 128)}{data?.authenticator && field("code", "Authenticator code", "text", 6)}{action === "password" && <>{field("newPassword", "New password", "password", 128)}{field("confirmPassword", "Confirm new password", "password", 128)}</>}</>}
      {action === "revoke" && field("pin", "Transaction PIN", "password", 4)}
      {action === "authenticator" && enrolment && <><img src={enrolment.qr} width={180} height={180} alt="Scan with your authenticator" className="mx-auto" /><p className="break-all font-mono text-xs text-muted-foreground">Setup key: {enrolment.secret}</p>{field("code", "Authenticator code", "text", 6)}</>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" variant="brand" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{action === "authenticator" && !enrolment ? "Start setup" : "Confirm"}</Button>
    </form></DialogContent></Dialog>
  </section>;
}