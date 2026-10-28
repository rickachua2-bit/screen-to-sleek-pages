import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { startMerchantVerification, verifyMerchantContact } from "@/lib/merchant-verification.functions";

export function MerchantContactVerification({ channel, value, onVerified }: { channel: "phone" | "email"; value: string; onVerified: (proof: { value: string; id: string } | null) => void }) {
  const start = useServerFn(startMerchantVerification);
  const verify = useServerFn(verifyMerchantContact);
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const current = useRef(value); current.current = value;
  const valid = channel === "phone" ? /^\+[1-9]\d{7,14}$/.test(value) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  async function send() {
    setOpen(true); setBusy(true); setError(""); setId(""); setVerified(false); setCode(""); onVerified(null);
    try { const r = await start({ data: { channel, email: channel === "email" ? value : "", phone: channel === "phone" ? value : "" } }); if (current.current === value) setId(r.challengeId); }
    catch (e) { if (current.current === value) setError(e instanceof Error ? e.message : "Could not send a verification code."); }
    finally { if (current.current === value) setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError("");
    try {
      await verify({ data: { challengeId: id, channel, code } });
      if (current.current === value) { setVerified(true); setOpen(false); setCode(""); onVerified({ value, id }); }
    } catch (e) { if (current.current === value) setError(e instanceof Error ? e.message : "Verification failed."); }
    finally { if (current.current === value) setBusy(false); }
  }
  if (!valid) return null;
  return <div className="mt-2 space-y-2">
    {verified ? <p className="flex items-center gap-1.5 text-xs font-bold text-success"><Check className="h-4 w-4" />{channel === "phone" ? "Phone number" : "Email"} verified</p> : !open ? <Button type="button" variant="outline" size="sm" aria-label={`Verify ${channel}`} className="border-cyan/40 text-cyan" onClick={send}>Verify {channel === "phone" ? "phone number" : "email"}</Button> : <div className="space-y-3 rounded-lg border border-cobalt/40 bg-cobalt/5 p-3" role="group" aria-label={`${channel} verification code`}>
      <p className="text-xs font-semibold text-body">{id ? "Code sent — enter your 6-digit OTP" : "Enter your 6-digit OTP"}</p>
      <InputOTP aria-label={`${channel} 6-digit OTP`} maxLength={6} value={code} onChange={setCode} autoFocus disabled={!id || busy} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (id && code.length === 6 && !busy) void submit(); } }}><InputOTPGroup className="gap-1">{[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} className="h-10 w-8 rounded-lg border text-lg" />)}</InputOTPGroup></InputOTP>
      <div className="flex flex-wrap gap-2"><Button variant="brand" size="sm" type="button" disabled={!id || busy || code.length !== 6} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirm code</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={send}>{id ? "Resend code" : "Retry sending"}</Button></div>
    </div>}
    {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
  </div>;
}