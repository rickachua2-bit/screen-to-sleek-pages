import { useSyncExternalStore } from "react";
import { currencyDef } from "./wallets";

const KEY = "slikpay.currency";
const listeners = new Set<() => void>();
let current: string | null = null;
const read = () => { if (current === null) { try { const v = localStorage.getItem(KEY); current = v && currencyDef(v) ? v : "NGN"; } catch { current = "NGN"; } } return current; };
export function setCurrency(code: string) { if (!currencyDef(code)) return; current = code; try { localStorage.setItem(KEY, code); } catch { /* storage unavailable */ } listeners.forEach((l) => l()); }
export function useCurrency() { return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, read, () => "NGN"); }
