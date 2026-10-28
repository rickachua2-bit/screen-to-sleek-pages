import { ShieldCheck } from "lucide-react";

export function ComplianceFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`mt-10 border-t border-border pt-5 text-center text-[11px] leading-relaxed text-muted-foreground ${className}`}>
      <p className="mx-auto flex max-w-3xl items-start justify-center gap-2">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
        <span><b className="text-foreground">Slikpay is a financial technology company, not a bank.</b> Banking services are provided by our licensed partner banks and regulated financial institutions in each market we serve.</span>
      </p>
    </footer>
  );
}
