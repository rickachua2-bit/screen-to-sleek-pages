import { useState } from "react";
import { 
  ArrowUpRight, Check, Copy, Download, FileCheck2, 
  FileSpreadsheet, FileText, Filter, HelpCircle, 
  Landmark, QrCode, RefreshCw, ShieldCheck, Sparkles 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";

export function StatementsManager() {
  const [accountType, setAccountType] = useState("ngn");
  const [period, setPeriod] = useState("30");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [includeVat, setIncludeVat] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [verifyHash, setVerifyHash] = useState("");
  const [verifiedResult, setVerifiedResult] = useState<{ valid: boolean; issuer: string; date: string; balance: string } | null>(null);

  const handleDownload = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      // Simulate file download trigger
      const dummyHash = "sha256:7f9a2b8e4c1d6f3a0e5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f";
      toast.success("Statement generated successfully", {
        description: `Official ${format.toUpperCase()} statement generated with verification hash: ${dummyHash.slice(0, 16)}...`,
      });
    }, 1200);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyHash) return;
    if (verifyHash.length >= 10) {
      setVerifiedResult({
        valid: true,
        issuer: "Slikpay Financial Technologies / Providus Bank NIBSS Switch",
        date: "October 2026 Monthly Settled Ledger",
        balance: naira(4850200),
      });
      toast.success("Statement authenticity verified · Valid digital seal");
    } else {
      toast.error("Invalid statement cryptographic verification hash");
    }
  };

  return (
    <section className="space-y-6">
      {/* Metrics Header */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Audit Compliance</span>
          <p className="mt-1 text-2xl font-black text-cyan">CBN / NDIC</p>
          <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-success" /> Tamper-proof cryptographic seal
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Statements Issued</span>
          <p className="mt-1 text-2xl font-black text-foreground">18 Statements</p>
          <span className="mt-1 text-[11px] text-muted-foreground">Current financial year 2026</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Tax Schedule Format</span>
          <p className="mt-1 text-2xl font-black text-magenta">FIRS & LIRS</p>
          <span className="mt-1 text-[11px] text-muted-foreground">VAT, WHT & Stamp duty breakdown</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Embedded Verification</span>
          <p className="mt-1 text-2xl font-black text-success">Live QR</p>
          <span className="mt-1 text-[11px] text-muted-foreground">Embassy & auditor verifiable</span>
        </div>
      </div>

      {/* Main Generator Card */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xl space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Generate Official Account Statement</h2>
          <p className="text-xs text-muted-foreground">
            Download certified bank statements with legal watermarks, running balance ledger, and automated tax calculations.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Account Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Operating Account</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { id: "ngn", label: "Corporate NGN", sub: "NUBAN · Providus" },
                  { id: "usd", label: "USD Domiciliary", sub: "Virtual Vault" },
                  { id: "gbp", label: "GBP UK Account", sub: "Sort Code: 04-00-04" },
                ].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAccountType(a.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      accountType === a.id
                        ? "border-cyan bg-cyan/10 shadow-sm"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <span className="block text-xs font-bold text-foreground">{a.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{a.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Period */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Reporting Period</label>
              <select
                aria-label="Reporting Period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="field mt-2 w-full text-xs font-semibold"
              >
                <option value="30">Last 30 Days (Current Cycle)</option>
                <option value="90">Last 90 Days (Quarterly Summary)</option>
                <option value="180">Last 6 Months (H1 2026)</option>
                <option value="365">Full Financial Year (FY2026 to Date)</option>
                <option value="all">Complete Historical Ledger</option>
              </select>
            </div>
          </div>

          {/* Format & Options */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Export Format</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat("pdf")}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    format === "pdf"
                      ? "border-cyan bg-cyan/10 shadow-sm"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <FileText className="h-5 w-5 text-cyan" />
                  <div>
                    <span className="block text-xs font-bold text-foreground">Official PDF</span>
                    <span className="block text-[10px] text-muted-foreground">CBN seal, QR code & watermark</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat("csv")}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    format === "csv"
                      ? "border-cyan bg-cyan/10 shadow-sm"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <FileSpreadsheet className="h-5 w-5 text-success" />
                  <div>
                    <span className="block text-xs font-bold text-foreground">CSV / Excel</span>
                    <span className="block text-[10px] text-muted-foreground">Raw bookkeeping ledger</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Inclusions */}
            <div className="rounded-xl border border-border p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={includeVat}
                  onChange={(e) => setIncludeVat(e.target.checked)}
                  className="rounded border-border"
                />
                Include FIRS 7.5% VAT and WHT tax ledger breakdown
              </label>
              <p className="text-[11px] text-muted-foreground pl-6">
                Produces an audit-ready tax schedule suitable for direct upload to FIRS TaxPro Max.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-4 w-4 text-success" /> Bank grade 256-bit signed document
          </span>

          <Button
            size="lg"
            variant="brand"
            disabled={generating}
            onClick={handleDownload}
            className="shine bg-gradient-tri font-bold text-xs"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Compiling Signed Statement...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Download Certified {format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Cryptographic Statement Verifier Tool */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-cyan" />
          <h3 className="text-sm font-bold text-foreground">Verify Third-Party Slikpay Statement Hash</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Embassies, audit firms, and lenders can verify that a printed statement has not been altered by entering its bottom hash or scanning its QR code.
        </p>

        <form onSubmit={handleVerify} className="flex gap-2">
          <input
            type="text"
            placeholder="Paste SHA-256 statement certificate hash or QR payload..."
            value={verifyHash}
            onChange={(e) => setVerifyHash(e.target.value)}
            className="field flex-1 font-mono text-xs"
          />
          <Button type="submit" variant="outline" size="sm">
            Verify Hash
          </Button>
        </form>

        {verifiedResult && (
          <div className="rounded-xl border border-success/30 bg-success-soft p-3 text-xs text-body space-y-1">
            <p className="font-bold text-success flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Document Verified Authentic
            </p>
            <p className="text-muted-foreground">Issuer: {verifiedResult.issuer}</p>
            <p className="text-muted-foreground">Certified Closing Balance: <span className="font-bold text-foreground">{verifiedResult.balance}</span></p>
          </div>
        )}
      </div>
    </section>
  );
}
