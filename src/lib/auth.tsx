import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Role, Txn, User } from "./api";
import { fetchProfile, fetchTransactions, supabase, toUser, type Profile } from "./supabase";

export interface SignUpMeta { full_name: string; phone?: string; company_name?: string; cac_rc_number?: string; category?: string; sliktag?: string }
export type AuthResult = { user: User; role: Role; token: string | null; needsConfirmation: boolean };

interface AuthState {
  token: string | null;
  user: User | null;
  role: Role | null;
  profile: Profile | null;
  txns: Txn[];
  ready: boolean;
  signUp: (email: string, password: string, role: Role, metadata: SignUpMeta) => Promise<AuthResult>;
  signInWithPassword: (c: { email: string; password: string }) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<void>;
  setRole: (r: Role) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [role, setRoleState] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) { setProfile(null); setTxns([]); setRoleState(null); return; }
    const metaRole = (s.user.user_metadata?.["role"] as Role | undefined) ?? "merchant";
    setRoleState((r) => r ?? metaRole);
    try {
      const [p, t] = await Promise.all([fetchProfile(s.user.id), fetchTransactions(s.user.id)]);
      setProfile(p);
      setTxns(t);
      if (p) setRoleState(p.role);
    } catch {
      setProfile(null);
      setTxns([]);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session).finally(() => setReady(true)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load(s);
      else if (event === "TOKEN_REFRESHED") setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const result = (s: Session | null, fallbackRole: Role, email: string, id: string, name?: string): AuthResult => ({
    user: toUser({ id, email, full_name: name ?? null }),
    role: fallbackRole,
    token: s?.access_token ?? null,
    needsConfirmation: !s,
  });

  const signUp: AuthState["signUp"] = async (email, password, r, metadata) => {
    if (r === "merchant") throw new Error("Merchant accounts require verified phone, email and business registration. Use the business sign-up steps.");
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth`, data: { ...metadata, role: r } },
    });
    if (error) throw error;
    if (data.session) await load(data.session);
    return result(data.session, r, email, data.user?.id ?? "", metadata.full_name);
  };

  const signInWithPassword: AuthState["signInWithPassword"] = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const p = await fetchProfile(data.user.id).catch(() => null);
    const r: Role = p?.role ?? ((data.user.user_metadata?.["role"] as Role) || "merchant");
    await load(data.session);
    return result(data.session, r, email, data.user.id, p?.full_name ?? (data.user.user_metadata?.["full_name"] as string | undefined));
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` });
    if (error) throw error;
  };

  const signOut = async () => { await supabase.auth.signOut(); await load(null); };
  const refresh = async () => { await load(session); };

  const user = session ? toUser({ id: session.user.id, email: profile?.email ?? session.user.email ?? "", full_name: profile?.full_name ?? (session.user.user_metadata?.["full_name"] as string | undefined) ?? null }) : null;

  return <Ctx.Provider value={{ token: session?.access_token ?? null, user, role, profile, txns, ready, signUp, signInWithPassword, resetPassword, setRole: setRoleState, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
