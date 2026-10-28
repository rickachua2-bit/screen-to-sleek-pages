import { useEffect, useState } from "react";
import { checkConnection, SUPABASE_URL, type Connection } from "@/lib/supabase";

const LABEL: Record<Connection, string> = {
  checking: "Checking connection…",
  connected: "Live · connected to Slikpay Cloud",
  "schema-missing": "Connected · database tables not installed",
  offline: "Not connected",
};

export function ConnectionBadge() {
  const [state, setState] = useState<Connection>("checking");
  useEffect(() => { void checkConnection().then(setState); }, []);
  const tone = state === "connected" ? "text-success" : state === "checking" ? "text-muted-foreground" : "text-destructive";
  const dot = state === "connected" ? "bg-success" : state === "checking" ? "bg-muted-foreground" : "bg-destructive";
  return (
    <span title={SUPABASE_URL} className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] font-semibold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${state === "connected" ? "animate-pulse" : ""}`} />
      {LABEL[state]}
    </span>
  );
}
