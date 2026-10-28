import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { startMerchantVerification, verifyMerchantContact } from "@/lib/merchant-verification.functions";

export function MerchantContactVerification({ email, phone, onComplete, onBack }: { email: string; phone: string; onComplete: (id: string) => void; onBack: () => void }) {
  const start = useServerFn(startMerchantVerification);
  const verify = useServerFn(verifyMerchantContact);
  const [id, setId] = useState("");
  const [channel, setChannel] = useState<"phone" | "email">("phone");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phoneDone, setPhoneDone] = useState(false);
  async function send() {
    setBusy(true); setError("");
    try { const r = await start({ data: { email, phone } }); setId(r.challengeId); setChannel("phone"); setPhoneDone(false); setCode(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not send verification codes."); }
    finally { setBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await verify({ data: { challengeId: id, channel, code } });
      if (channel === "phone") { setPhoneDone(true); setChannel("email"); setCode(""); }
      else onComplete(id);
    } catch (e) { setError(e instanceof Error ? e.message : "Verification failed."); }
    finally { setBusy(false); }
  }
  const Icon = channel === "phone" ? Smartphone : Mail;
  return <form onSubmit={submit} className="space-y-4">
    <Icon className="h-8 w-8 text-cyan" />
    <h2 className="text-xl font-black text-foreground">Verify your {channel === "phone" ? "phone number" : "email"}</h2>
    <p className="break-words text-sm text-body">{channel === "phone" ? phone : email}</p>
    {phoneDone && <p className="flex items-center gap-2 text-sm font-bold text-success"><Check className="h-4 w-4" />Phone number verified</p>}
    {id ? <>
      <div className="flex justify-center"><InputOTP maxLength={6} value={code} onChange={setCode} autoFocus><InputOTPGroup className="gap-1.5">{[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-9 rounded-lg border text-lg" />)}</InputOTPGroup></InputOTP></div>
      <Button variant="brand" type="submit" className="h-12 w-full" disabled={busy || code.length !== 6}>{busy && <Loader2 className="animate-spin" />}Verify {channel === "phone" ? "phone" : "email"}</Button>
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={send}>Request fresh codes</Button>
    </> : <Button type="button" variant="brand" className="h-12 w-full" disabled={busy} onClick={send}>{busy && <Loader2 className="animate-spin" />}Send phone and email codes</Button>}
    {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
    <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={onBack}>Back to account details</Button>
  </form>;
}