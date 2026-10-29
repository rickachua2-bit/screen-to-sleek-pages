import { useState } from "react";
import { 
  AlertTriangle, Check, Clock, Download, FileText, 
  HelpCircle, MessageSquare, Plus, RefreshCw, Scale, 
  ShieldAlert, ShieldCheck, Upload, X 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";

interface DisputeCase {
  id: string;
  reference: string;
  customer: string;
  amount: number;
  reason: string;
  status: "evidence_required" | "under_review" | "resolved" | "conceded";
  dueDate: string;
  channel: string;
  summary: string;
  evidenceSubmitted?: boolean;
}

const INITIAL_CASES: DisputeCase[] = [
  {
    id: "DSP-8921",
    reference: "SLK-TX-90182",
    customer: "Chukwudi Eze",
    amount: 45000,
    reason: "Goods not received / service unrendered",
    status: "evidence_required",
    dueDate: "Tomorrow, 5:00 PM",
    channel: "SmartTag Tap POS",
    summary: "Customer claims POS terminal charged twice but goods were delivered once.",
    evidenceSubmitted: false,
  },
  {
    id: "DSP-8919",
    reference: "SLK-TX-88412",
    customer: "Bisi Adeleke",
    amount: 125000,
    reason: "Unauthorized / fraudulent card charge",
    status: "under_review",
    dueDate: "3 days remaining",
    channel: "Virtual Terminal",
    summary: "Mastercard issuer chargeback claim regarding 3D-Secure liability shift.",
    evidenceSubmitted: true,
  },
  {
    id: "DSP-8802",
    reference: "SLK-TX-79210",
    customer: "Alhaji Musa Bello",
    amount: 82000,
    reason: "Duplicate debit on NIP transfer",
    status: "resolved",
    dueDate: "Closed Oct 24",
    channel: "NIP Commercial Transfer",
    summary: "Issuer session dispute matched NIBSS settlement trace. Won by merchant.",
    evidenceSubmitted: true,
  },
];

export function DisputesManager() {
  const [cases, setCases] = useState<DisputeCase[]>(INITIAL_CASES);
  const [tab, setTab] = useState<"active" | "review" | "resolved">("active");
  const [selectedCase, setSelectedCase] = useState<DisputeCase | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [uploading, setUploading] = useState(false);

  const activeCases = cases.filter((c) => c.status === "evidence_required");
  const reviewCases = cases.filter((c) => c.status === "under_review");
  const resolvedCases = cases.filter((c) => c.status === "resolved" || c.status === "conceded");

  const displayed = tab === "active" ? activeCases : tab === "review" ? reviewCases : resolvedCases;
  const totalDisputed = cases.filter((c) => c.status !== "resolved").reduce((a, b) => a + b.amount, 0);

  const handleEvidenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setUploading(true);

    setTimeout(() => {
      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id
            ? { ...c, status: "under_review", evidenceSubmitted: true }
            : c
        )
      );
      setUploading(false);
      setSelectedCase(null);
      setEvidenceNote("");
      setTrackingNumber("");
      toast.success("Dispute evidence submitted successfully", {
        description: "Bank dispute desk and card network notified. Case moved to review.",
      });
    }, 900);
  };

  const handleConcede = (c: DisputeCase) => {
    if (confirm(`Are you sure you want to accept this chargeback of ${naira(c.amount)}? Funds will be refunded to the buyer.`)) {
      setCases((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, status: "conceded" } : item))
      );
      toast.info("Dispute conceded", {
        description: `Refund of ${naira(c.amount)} released to cardholder. Case closed.`,
      });
    }
  };

  return (
    <section className="space-y-6">
      {/* Top Banner & Telemetry */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Action Required</span>
          <p className="mt-1 text-2xl font-black text-destructive">{activeCases.length} cases</p>
          <span className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
            <Clock className="h-3 w-3" /> Response due within 48h
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">At-Risk Funds</span>
          <p className="mt-1 text-2xl font-black text-foreground">{naira(totalDisputed)}</p>
          <span className="mt-1 text-[11px] text-muted-foreground">Locked in vault buffer</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Merchant Win Rate</span>
          <p className="mt-1 text-2xl font-black text-success">98.4%</p>
          <span className="mt-1 text-[11px] text-success">Above industry average</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Network Liability</span>
          <p className="mt-1 text-2xl font-black text-cyan">Protected</p>
          <span className="mt-1 text-[11px] text-muted-foreground">3D-Secure & PIN verified</span>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-2">
        <div className="flex gap-2">
          <Button
            variant={tab === "active" ? "brand" : "ghost"}
            size="sm"
            onClick={() => setTab("active")}
            className="rounded-full"
          >
            <ShieldAlert className="h-4 w-4" /> Open Cases ({activeCases.length})
          </Button>
          <Button
            variant={tab === "review" ? "brand" : "ghost"}
            size="sm"
            onClick={() => setTab("review")}
            className="rounded-full"
          >
            <Clock className="h-4 w-4" /> In Review ({reviewCases.length})
          </Button>
          <Button
            variant={tab === "resolved" ? "brand" : "ghost"}
            size="sm"
            onClick={() => setTab("resolved")}
            className="rounded-full"
          >
            <Check className="h-4 w-4" /> Resolved ({resolvedCases.length})
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => toast.info("Dispute queue synced with NIBSS and Visa/Mastercard")}>
          <RefreshCw className="h-3.5 w-3.5" /> Sync Cases
        </Button>
      </div>

      {/* Disputes Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground">
            <tr>
              <th className="p-4">Case ID & Transaction</th>
              <th className="p-4">Customer & Channel</th>
              <th className="p-4">Disputed Amount</th>
              <th className="p-4">Reason & Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-medium">
            {displayed.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-muted/20">
                <td className="p-4">
                  <span className="font-mono font-bold text-foreground">{c.id}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{c.reference}</span>
                </td>
                <td className="p-4">
                  <span className="font-semibold text-foreground">{c.customer}</span>
                  <span className="block text-xs text-muted-foreground">{c.channel}</span>
                </td>
                <td className="p-4">
                  <span className="font-extrabold text-foreground">{naira(c.amount)}</span>
                </td>
                <td className="p-4">
                  <span className="block text-xs font-semibold text-foreground">{c.reason}</span>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      c.status === "evidence_required"
                        ? "border border-destructive/40 bg-destructive/10 text-destructive"
                        : c.status === "under_review"
                        ? "border border-cyan/40 bg-cyan/10 text-cyan"
                        : c.status === "resolved"
                        ? "border border-success/40 bg-success-soft text-success"
                        : "border border-muted text-muted-foreground"
                    }`}
                  >
                    {c.status.replace("_", " ")} · {c.dueDate}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {c.status === "evidence_required" && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="brand"
                        onClick={() => setSelectedCase(c)}
                        className="shine bg-gradient-tri text-xs font-bold"
                      >
                        <Upload className="h-3.5 w-3.5" /> Submit Evidence
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConcede(c)}
                        className="text-xs text-destructive hover:bg-destructive/10"
                      >
                        Accept
                      </Button>
                    </div>
                  )}
                  {c.status === "under_review" && (
                    <span className="text-xs font-semibold text-cyan">Awaiting Bank Decision</span>
                  )}
                  {c.status === "resolved" && (
                    <span className="text-xs font-semibold text-success">Won · Funds Credited</span>
                  )}
                  {c.status === "conceded" && (
                    <span className="text-xs font-semibold text-muted-foreground">Refunded</span>
                  )}
                </td>
              </tr>
            ))}
            {!displayed.length && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  <Scale className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                  <p className="font-semibold">No cases in this queue</p>
                  <p className="text-xs">Your chargeback rate is 0.00% within acceptable network thresholds.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Evidence Submission Modal */}
      {selectedCase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 slik-overlay-backdrop backdrop-blur-sm"
          onClick={() => setSelectedCase(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-extrabold text-foreground">Prepare Dispute Defense Evidence</h2>
                <span className="font-mono text-xs text-muted-foreground">Case {selectedCase.id} · {naira(selectedCase.amount)}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCase(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-xl border border-cobalt/20 bg-cobalt/5 p-3 text-xs text-body space-y-1">
              <p className="font-bold text-foreground">Dispute Reason: {selectedCase.reason}</p>
              <p className="text-muted-foreground">{selectedCase.summary}</p>
            </div>

            <form onSubmit={handleEvidenceSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground">Tracking Number / Dispatch Ref (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. GIG-LOGISTICS-910283"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="field mt-1 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Merchant Statement / Rebuttal</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain proof of fulfillment, delivery date, customer communication, or authorization log..."
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  className="field mt-1 w-full text-xs resize-none"
                />
              </div>

              <div className="rounded-xl border border-dashed border-border p-4 text-center cursor-pointer hover:border-cyan/50 transition-colors">
                <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-xs font-bold text-foreground">Upload Signed Delivery Note, Invoice or Chats</p>
                <p className="text-[11px] text-muted-foreground">PDF, PNG, JPG up to 10MB each</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedCase(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploading || !evidenceNote}
                  className="flex-1 shine bg-gradient-tri font-bold"
                >
                  {uploading ? "Submitting to Bank..." : "Submit to Dispute Desk"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
