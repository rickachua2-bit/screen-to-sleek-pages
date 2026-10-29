import { useState, useEffect } from "react";
import { 
  AlertTriangle, Check, CheckCircle2, Clock, Download, FileText, 
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

export function DisputesManager() {
  const [cases, setCases] = useState<DisputeCase[]>(() => {
    try {
      const s = localStorage.getItem("slikpay_merchant_disputes");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [tab, setTab] = useState<"active" | "review" | "resolved">("active");
  const [selectedCase, setSelectedCase] = useState<DisputeCase | null>(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showNewDisputeModal, setShowNewDisputeModal] = useState(false);
  const [evidenceText, setEvidenceText] = useState("");
  const [uploading, setUploading] = useState(false);

  // New dispute form state
  const [newCust, setNewCust] = useState("");
  const [newTxRef, setNewTxRef] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newReason, setNewReason] = useState("Goods or service unrendered");

  useEffect(() => {
    try {
      localStorage.setItem("slikpay_merchant_disputes", JSON.stringify(cases));
    } catch {}
  }, [cases]);

  const activeCases = cases.filter((c) => c.status === "evidence_required");
  const underReviewCases = cases.filter((c) => c.status === "under_review");
  const resolvedCases = cases.filter((c) => c.status === "resolved" || c.status === "conceded");

  const totalAtRisk = activeCases.reduce((acc, c) => acc + c.amount, 0);

  const handleSubmitEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !evidenceText) {
      toast.error("Please enter a summary of evidence.");
      return;
    }

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
      setShowEvidenceModal(false);
      setEvidenceText("");
      toast.success("Evidence Transmitted to Card Scheme / CBN Rail", {
        description: `Case ${selectedCase.id} is now under regulatory arbitration.`,
      });
    }, 700);
  };

  const handleConcede = (c: DisputeCase) => {
    setCases((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, status: "conceded" } : item))
    );
    toast.info("Dispute Conceded & Refund Released", {
      description: `Refunded ${naira(c.amount)} to customer card. Case closed.`,
    });
  };

  const handleCreateDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust || !newTxRef || !newAmount) {
      toast.error("Please fill in customer name, reference and amount");
      return;
    }

    const created: DisputeCase = {
      id: `DSP-${Date.now().toString().slice(-4)}`,
      reference: newTxRef,
      customer: newCust,
      amount: Number(newAmount),
      reason: newReason,
      status: "evidence_required",
      dueDate: "3 days remaining",
      channel: "Card / POS Payment",
      summary: `Customer filed chargeback claim for transaction ${newTxRef}.`,
      evidenceSubmitted: false,
    };

    setCases([created, ...cases]);
    setShowNewDisputeModal(false);
    setNewCust("");
    setNewTxRef("");
    setNewAmount("");
    toast.success(`Dispute logged: ${created.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <Scale className="h-6 w-6 text-cobalt" />
            Dispute & Chargeback Resolution Desk
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Defend against chargebacks, submit proof of delivery, and track CBN / Mastercard arbitration timelines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowNewDisputeModal(true)}
            className="bg-cobalt text-white hover:bg-cobalt/90 font-bold"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Log Dispute Claim
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Open Disputes</span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <p className="mt-2 text-2xl font-black text-destructive">{activeCases.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Action required</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Amount At Risk</span>
            <Scale className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-500">{naira(totalAtRisk)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">In escrow pending proof</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Under Arbitration</span>
            <Clock className="h-4 w-4 text-cyan" />
          </div>
          <p className="mt-2 text-2xl font-black text-cyan">{underReviewCases.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Awaiting scheme verdict</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Dispute Win Rate</span>
            <ShieldCheck className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-black text-success">
            {cases.length === 0 ? "100%" : "98.4%"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Liability protected</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("active")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "active"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Evidence Required ({activeCases.length})
        </button>
        <button
          onClick={() => setTab("review")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "review"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          Under Arbitration ({underReviewCases.length})
        </button>
        <button
          onClick={() => setTab("resolved")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "resolved"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Closed & Resolved ({resolvedCases.length})
        </button>
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        {(tab === "active" ? activeCases : tab === "review" ? underReviewCases : resolvedCases).length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
            <h3 className="text-base font-bold text-foreground">
              {tab === "active" ? "All Clear! Zero Open Disputes" : "No Disputes in this View"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {tab === "active"
                ? "Your merchant account currently has zero chargebacks or customer retrieval requests. All POS taps, cards, and NIP transfers are settled cleanly."
                : "No past or pending arbitration claims found in this category."}
            </p>
          </div>
        ) : (
          (tab === "active" ? activeCases : tab === "review" ? underReviewCases : resolvedCases).map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-border/80 md:flex-row md:items-center"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-cyan">{c.id}</span>
                  <span className="text-xs text-muted-foreground">· Ref: {c.reference}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {c.channel}
                  </span>
                  <span className="text-xs font-semibold text-amber-500">
                    Deadline: {c.dueDate}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-foreground">
                  {c.customer} — {naira(c.amount)}
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  {c.summary}
                </p>

                <div className="flex items-center gap-2 text-xs font-bold text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Reason: {c.reason}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 border-t border-border pt-3 md:border-none md:pt-0">
                {c.status === "evidence_required" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                      onClick={() => handleConcede(c)}
                    >
                      Concede & Refund
                    </Button>
                    <Button
                      size="sm"
                      className="bg-cobalt text-white hover:bg-cobalt/90 text-xs"
                      onClick={() => {
                        setSelectedCase(c);
                        setShowEvidenceModal(true);
                      }}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Submit Evidence
                    </Button>
                  </>
                )}

                {c.status === "under_review" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan/15 px-3 py-1 text-xs font-bold text-cyan">
                    <Clock className="h-3.5 w-3.5" />
                    Under Scheme Review
                  </span>
                )}

                {c.status === "resolved" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resolved (Won by Merchant)
                  </span>
                )}

                {c.status === "conceded" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    Conceded & Refunded
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* EVIDENCE SUBMISSION MODAL */}
      {showEvidenceModal && selectedCase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setShowEvidenceModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Submit Dispute Evidence</h2>
                <p className="text-xs text-muted-foreground font-mono">Case: {selectedCase.id}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowEvidenceModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmitEvidence} className="space-y-4 text-xs">
              <div className="rounded-xl border border-border bg-card/60 p-3 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Customer:</span>
                  <span>{selectedCase.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-black text-cyan">{naira(selectedCase.amount)}</span>
                </div>
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">
                  Defense Statement & Proof of Fulfillment
                </label>
                <textarea
                  rows={4}
                  placeholder="Detail invoice number, delivery note confirmation, POS audit trace, or CCTV confirmation..."
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  className="field w-full text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">
                  Upload Receipts, Invoices or Signatures (PDF / JPG)
                </label>
                <input type="file" className="field w-full text-xs" />
              </div>

              <Button
                type="submit"
                className="w-full bg-cobalt text-white hover:bg-cobalt/90 font-bold"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Transmitting Evidence...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Submit to Scheme Arbitration
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* NEW DISPUTE MODAL */}
      {showNewDisputeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setShowNewDisputeModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Log Dispute Claim</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowNewDisputeModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateDispute} className="space-y-4 text-xs">
              <div>
                <label className="block text-foreground font-bold mb-1">Customer Name</label>
                <input
                  placeholder="e.g. John Doe"
                  value={newCust}
                  onChange={(e) => setNewCust(e.target.value)}
                  className="field w-full text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Transaction Reference</label>
                <input
                  placeholder="e.g. SLK-TX-90182"
                  value={newTxRef}
                  onChange={(e) => setNewTxRef(e.target.value)}
                  className="field w-full text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Disputed Amount (NGN)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="field w-full text-xs font-mono"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-cobalt text-white font-bold hover:bg-cobalt/90">
                Register Dispute
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
