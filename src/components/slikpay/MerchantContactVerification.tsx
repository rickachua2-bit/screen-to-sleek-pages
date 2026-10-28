import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { startMerchantVerification, verifyMerchantContact } from "@/lib/merchant-verification.functions";
import { verificationRetry } from "@/lib/provider-errors";

export function MerchantContactVerification({ channel, value, onVerified }: { channel: "phone" | "email"; value: string; onVerified: (proof: { value: string; id: string } | null) => void }) {
  const start = useServerFn(startMerchantVerification);
  const verify = useServerFn(verifyMerchantContact);
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!retryUntil) return;
    const tick = () => setRetrySeconds(Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [retryUntil]);
  const report = (e: unknown) => { const failure = verificationRetry(e); setError(failure.message); if (failure.seconds) { setRetrySeconds(failure.seconds); setRetryUntil(Date.now() + failure.seconds * 1000); } };
  const current = useRef(value); current.current = value;
  const valid = channel === "phone" ? /^\+[1-9]\d{7,14}$/.test(value) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  async function send() {
    if (inFlight.current || Date.now() < retryUntil) return;
    inFlight.current = true; setOpen(true); setBusy(true); setError("");
    try { const r = await start({ data: { channel, email: channel === "email" ? value : "", phone: channel === "phone" ? value : "" } }); if (current.current === value) { setId(r.challengeId); setVerified(false); setCode(""); onVerified(null); } }
    catch (e) { if (current.current === value) report(e); }
    finally { inFlight.current = false; if (current.current === value) setBusy(false); }
  }
  async function submit() {
    if (inFlight.current || Date.now() < retryUntil || !id || code.length !== 6) return;
    inFlight.current = true;
    setBusy(true); setError("");
    try {
      await verify({ data: { challengeId: id, channel, code } });
      if (current.current === value) { setVerified(true); setOpen(false); setCode(""); onVerified({ value, id }); }
    } catch (e) { if (current.current === value) report(e); }
    finally { inFlight.current = false; if (current.current === value) setBusy(false); }
  }
  if (!valid) return null;
  return <div className="mt-2 space-y-2">
    {verified ? <p className="flex items-center gap-1.5 text-xs font-bold text-success"><Check className="h-4 w-4" />{channel === "phone" ? "Phone number" : "Email"} verified</p> : !open ? <Button type="button" variant="outline" size="sm" aria-label={`Verify ${channel}`} className="border-cyan/40 text-cyan" onClick={send}>Verify {channel === "phone" ? "phone number" : "email"}</Button> : <div className="otp-panel space-y-3.5 rounded-2xl p-4" role="group" aria-label={`${channel} verification code`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-foreground">{id ? "Code sent — enter your 6-digit OTP" : "Enter your 6-digit OTP"}</p>
        <span className="rounded-full bg-cobalt/25 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan">{channel === "phone" ? "SMS" : "Email"}</span>
      </div>
      <p className="-mt-2 truncate font-mono text-[11px] font-semibold text-muted-foreground" title={value}>{value}</p>
      <InputOTP aria-label={`${channel} 6-digit OTP`} maxLength={6} value={code} onChange={setCode} autoFocus disabled={!id || busy} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (id && code.length === 6 && !busy) void submit(); } }}><InputOTPGroup className="gap-1.5">{[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} className="otp-slot first:rounded-l-[0.7rem] last:rounded-r-[0.7rem]" />)}</InputOTPGroup></InputOTP>
      <div className="flex flex-wrap gap-2"><Button variant="brand" size="sm" type="button" disabled={!id || busy || retrySeconds > 0 || code.length !== 6} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirm code</Button><Button type="button" variant="ghost" size="sm" disabled={busy || retrySeconds > 0} onClick={send}>{retrySeconds > 0 ? `Try again in ${retrySeconds}s` : id ? "Resend code" : "Retry sending"}</Button></div>
    </div>}
    {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
  </div>;
}