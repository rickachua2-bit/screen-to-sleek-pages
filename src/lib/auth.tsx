import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "./api";

interface AuthState {
  token: string | null;
  user: User | null;
  role: Role | null;
  ready: boolean;
  signIn: (token: string, user: User, role: Role, remember: boolean) => void;
  setRole: (r: Role) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const store = localStorage.getItem("slikpay_token") ? localStorage : sessionStorage;
    setToken(store.getItem("slikpay_token"));
    const u = store.getItem("slikpay_user");
    setUser(u ? JSON.parse(u) : null);
    setRoleState((store.getItem("slikpay_role") as Role) || null);
    setReady(true);
  }, []);

  const signIn: AuthState["signIn"] = (t, u, r, remember) => {
    const store = remember ? localStorage : sessionStorage;
    store.setItem("slikpay_token", t);
    store.setItem("slikpay_user", JSON.stringify(u));
    store.setItem("slikpay_role", r);
    // The API client reads the token from localStorage; keep it there for the session.
    localStorage.setItem("slikpay_token", t);
    setToken(t);
    setUser(u);
    setRoleState(r);
  };
  const setRole = (r: Role) => {
    (localStorage.getItem("slikpay_role") ? localStorage : sessionStorage).setItem("slikpay_role", r);
    setRoleState(r);
  };
  const signOut = () => {
    for (const k of ["slikpay_token", "slikpay_user", "slikpay_role"]) {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }
    setToken(null);
    setUser(null);
    setRoleState(null);
  };

  return <Ctx.Provider value={{ token, user, role, ready, signIn, setRole, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
