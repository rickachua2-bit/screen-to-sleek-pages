import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Role, Txn, User } from "./api";

// Slikpay's dedicated project. The publishable key is safe in browser code;
// Row-Level Security protects every table.
export const SUPABASE_URL = "https://gqbgdqkmdyvzgovugjku.supabase.co";
const SUPABASE_KEY = "sb_publishable_gm4BLAoVwoF-a8lcOStsEg_Rot7Y0cW";

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "slikpay-auth" },
    });
  }
  return client;
}
export const supabase = new Proxy({} as SupabaseClient, { get: (_t, p) => Reflect.get(getSupabase(), p) });

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  company_name: string | null;
  cac_rc_number: string | null;
  nuban: string | null;
  bank_name: string | null;
  wallet_balance: number;
  created_at: string;
}

export const toUser = (p: Pick<Profile, "id" | "email" | "full_name">): User => {
  const name = p.full_name?.trim() || p.email.split("@")[0]!;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  return { id: p.id, name, email: p.email, initials };
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data ? { ...data, wallet_balance: Number(data.wallet_balance ?? 0) } as Profile : null;
}

export async function fetchTransactions(userId: string, limit = 100): Promise<Txn[]> {
  const { data, error } = await supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, date: r.created_at, ref: r.reference, channel: r.channel, customer: r.customer,
    amount: Number(r.amount), direction: r.direction, status: r.status,
  })) as Txn[];
}

export type Connection = "checking" | "connected" | "schema-missing" | "offline";
export async function checkConnection(): Promise<Connection> {
  try {
    const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    if (!error) return "connected";
    return error.code === "PGRST205" || error.code === "42P01" ? "schema-missing" : "offline";
  } catch {
    return "offline";
  }
}
