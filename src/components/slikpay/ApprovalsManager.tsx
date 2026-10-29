import { useState, useEffect } from "react";
import { 
  Check, CheckCircle2, Clock, Eye, FileText, 
  HelpCircle, Lock, Plus, RotateCcw, 
  Scale, ShieldAlert, ShieldCheck, UserCheck, Users, X 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";

export interface ApprovalRequest {
  id: string;
  reference: string;
  title: string;
  category: "treasury" | "payroll" | "compliance" | "security";
  makerName: string;
  makerRole: string;
  makerEmail: string;
  amount?: number;
  recipient?: string;
  createdAt: string;
  thresholdTrigger: string;
  details: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  checkerName?: string;
  checkedAt?: string;
  rejectionReason?: string;
}

export function ApprovalsManager() {
  const [requests, setRequests] = useState<ApprovalRequest[]>(() => {
    try {
      const s = localStorage.getItem("slikpay_governance_requests");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [tab, setTab] = useState<"pending" | "history" | "policies">("pending");
  const [selectedReq, setSelectedReq] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [pin, setPin] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [policyThreshold, setPolicyThreshold] = useState("1000000");
  const [dualControlActive, setDualControlActive] = useState(true);

  // New proposal modal
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [newDetails, setNewDetails] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("slikpay_governance_requests", JSON.stringify(requests));
    } catch {}
  }, [requests]);

  const pendingList = requests.filter((r) => r.status === "PENDING");
  const historyList = requests.filter((r) => r.status !== "PENDING");

  const handleApprove = () => {
    if (!selectedReq) return;
    if (pin.length < 4) {
      toast.error("Please enter your 4-digit security PIN to authorize");
      return;
    }
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedReq.id
          ? {
              ...r,
              status: "APPROVED",
              checkerName: "You (Authorized Checker)",
              checkedAt: "Just now",
            }
          : r
      )
    );
    toast.success(`Authorized: ${selectedReq.title}`, {
      description: `Disbursement released. Dual-signature audit hash recorded.`,
    });
    setSelectedReq(null);
    setActionType(null);
    setPin("");
  };

  const handleReject = () => {
    if (!selectedReq) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedReq.id
          ? {
              ...r,
              status: "REJECTED",
              checkerName: "You (Governance Checker)",
              checkedAt: "Just now",
              rejectionReason: rejectReason,
            }
          : r
      )
    );
    toast.warning(`Rejected: ${selectedReq.title}`, {
      description: `Request returned to Maker. Audit trail notified.`,
    });
    setSelectedReq(null);
    setActionType(null);
    setRejectReason("");
  };

  const handleCreateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) {
      toast.error("Please enter a title for the proposal");
      return;
    }

    const created: ApprovalRequest = {
      id: `APR-${Date.now().toString().slice(-4)}`,
      reference: `REQ-${Date.now().toString().slice(-6)}`,
      title: newTitle,
      category: "treasury",
      makerName: "Operations Officer",
      makerRole: "Maker",
      makerEmail: "finance@slikmerchant.ng",
      amount: newAmount ? Number(newAmount) : undefined,
      recipient: newRecipient || "External Bank / Rail",
      createdAt: "Just now",
      thresholdTrigger: "Dual Control Policy Threshold Breached",
      details: newDetails || "Sensitive high-value disbursement submitted for 4-Eyes review.",
      status: "PENDING",
    };

    setRequests([created, ...requests]);
    setShowProposeModal(false);
    setNewTitle("");
    setNewAmount("");
    setNewRecipient("");
    setNewDetails("");
    toast.success("Governance Proposal Submitted", {
      description: "Queued for secondary Checker authorization.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and Telemetry */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <Scale className="h-6 w-6 text-cobalt" />
            Maker-Checker Governance Desk
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            CBN dual-control authorization engine. Sensitive transfers and configuration edits require 4-Eyes sign-off.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowProposeModal(true)}
            className="bg-cobalt text-white hover:bg-cobalt/90 font-bold"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Propose Dual-Control Action
          </Button>
          <div className="flex items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-bold text-cyan">
            <ShieldCheck className="h-4 w-4" />
            {dualControlActive ? "Dual Control: Active (Strict)" : "Single Approval"}
          </div>
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Sign-off</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-500">{pendingList.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Requires authorized Checker</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Volume</span>
            <Users className="h-4 w-4 text-cyan" />
          </div>
          <p className="mt-2 text-2xl font-black text-cyan">
            {naira(pendingList.reduce((acc, r) => acc + (r.amount || 0), 0))}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Awaiting disbursement gate</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Approval Threshold</span>
            <Lock className="h-4 w-4 text-cobalt" />
          </div>
          <p className="mt-2 text-2xl font-black text-cobalt">{naira(Number(policyThreshold))}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Trigger limit for 4-Eyes</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Audit Security</span>
            <ShieldAlert className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-black text-success">100%</p>
          <p className="mt-1 text-[11px] text-muted-foreground">SHA-256 Chained Ledger</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("pending")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "pending"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          Pending Approvals
          {pendingList.length > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-500">
              {pendingList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "history"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          Authorization History ({historyList.length})
        </button>
        <button
          onClick={() => setTab("policies")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "policies"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Governance Policies & Limits
        </button>
      </div>

      {/* TAB 1: PENDING APPROVALS */}
      {tab === "pending" && (
        <div className="space-y-4">
          {pendingList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
              <h3 className="text-base font-bold text-foreground">All Clear! No Pending Requests</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                All high-value payouts and critical changes have been reviewed and approved.
              </p>
            </div>
          ) : (
            pendingList.map((req) => (
              <div
                key={req.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-border/80 md:flex-row md:items-center"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-extrabold text-amber-500">
                      PENDING CHECKER
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
                      {req.id}
                    </span>
                    <span className="text-xs font-bold text-cyan">{req.thresholdTrigger}</span>
                  </div>

                  <h3 className="text-base font-extrabold text-foreground">{req.title}</h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {req.details}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Maker: <strong className="text-foreground">{req.makerName}</strong> ({req.makerRole})
                    </span>
                    {req.recipient && (
                      <span>
                        Destination: <strong className="text-foreground">{req.recipient}</strong>
                      </span>
                    )}
                    <span>Submitted: {req.createdAt}</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-border pt-3 md:flex-col md:items-end md:border-none md:pt-0">
                  {req.amount && (
                    <div className="text-left md:text-right">
                      <p className="text-xs text-muted-foreground">Request Value</p>
                      <p className="text-xl font-black text-foreground">{naira(req.amount)}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setSelectedReq(req);
                        setActionType("reject");
                      }}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-success text-white hover:bg-success/90"
                      onClick={() => {
                        setSelectedReq(req);
                        setActionType("approve");
                      }}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Authorize
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: AUTHORIZATION HISTORY */}
      {tab === "history" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          {historyList.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No authorization decisions recorded yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="p-4">Action / Request</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Maker</th>
                  <th className="p-4">Checker</th>
                  <th className="p-4">Decision Date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyList.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{req.title}</div>
                      <div className="font-mono text-xs text-muted-foreground">{req.id} · {req.reference}</div>
                      {req.rejectionReason && (
                        <div className="mt-1 text-xs text-destructive">
                          Reason: {req.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono font-bold text-foreground">
                      {req.amount ? naira(req.amount) : "—"}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      <div>{req.makerName}</div>
                      <div>{req.makerRole}</div>
                    </td>
                    <td className="p-4 text-xs">
                      {req.checkerName ? (
                        <span className="font-semibold text-foreground">{req.checkerName}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {req.checkedAt || req.createdAt}
                    </td>
                    <td className="p-4">
                      {req.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
                          <Check className="h-3 w-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
                          <X className="h-3 w-3" />
                          Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: GOVERNANCE POLICIES & LIMITS */}
      {tab === "policies" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-cyan" />
              Maker-Checker Dual Control Gate
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When dual control is active, any transaction or configuration update exceeding your threshold cannot be executed by the person who submitted it. A secondary authorized Checker must verify and sign off.
            </p>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-bold text-foreground">Enforce 4-Eyes Principle</p>
                <p className="text-xs text-muted-foreground">Mandatory for CBN Tier-3 business compliance</p>
              </div>
              <input
                type="checkbox"
                checked={dualControlActive}
                onChange={(e) => {
                  setDualControlActive(e.target.checked);
                  toast.success(
                    e.target.checked
                      ? "Dual control governance activated"
                      : "Dual control governance deactivated"
                  );
                }}
                className="h-5 w-5 accent-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground">
                Automatic Dual-Control Threshold (NGN)
              </label>
              <select
                value={policyThreshold}
                onChange={(e) => setPolicyThreshold(e.target.value)}
                className="field mt-1.5 w-full text-sm"
              >
                <option value="500000">₦500,000 (Strict Operational Standard)</option>
                <option value="1000000">₦1,000,000 (Default Recommended)</option>
                <option value="5000000">₦5,000,000 (Corporate Enterprise)</option>
                <option value="10000000">₦10,000,000 (Institutional Only)</option>
              </select>
            </div>

            <Button
              className="w-full bg-cobalt text-white hover:bg-cobalt/90 font-bold"
              onClick={() => toast.success("Governance policies saved successfully")}
            >
              Update Policy Rules
            </Button>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-cobalt" />
              Authorized Checker Roles
            </h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 p-3">
                <div>
                  <p className="font-bold text-foreground">Account Owner / Super Admin</p>
                  <p className="text-muted-foreground">Full unconstrained authorization privileges</p>
                </div>
                <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-extrabold text-success">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 p-3">
                <div>
                  <p className="font-bold text-foreground">Finance Director / Controller</p>
                  <p className="text-muted-foreground">Authorized for treasury sweeps & payroll releases</p>
                </div>
                <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-extrabold text-success">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROPOSAL MODAL */}
      {showProposeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setShowProposeModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Propose Dual-Control Action</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowProposeModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateProposal} className="space-y-4 text-xs">
              <div>
                <label className="block text-foreground font-bold mb-1">Proposal Title</label>
                <input
                  placeholder="e.g. Treasury Sweep to External Bank"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="field w-full text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Disbursement Amount (NGN)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000000"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="field w-full text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Destination Beneficiary</label>
                <input
                  placeholder="e.g. Zenith Bank Corporate Treasury"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  className="field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Rationale & Notes</label>
                <textarea
                  rows={3}
                  placeholder="State the operational justification for this disbursement..."
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  className="field w-full text-xs"
                />
              </div>

              <Button type="submit" className="w-full bg-cobalt text-white font-bold hover:bg-cobalt/90">
                Submit Proposal to Checker Gate
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* APPROVAL / REJECTION MODAL */}
      {selectedReq && actionType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => {
            setSelectedReq(null);
            setActionType(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                {actionType === "approve" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Authorize Transaction (Checker)
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-5 w-5 text-destructive" />
                    Reject Governance Proposal
                  </>
                )}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedReq(null);
                  setActionType(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Request:</span>
                <span className="font-bold text-foreground">{selectedReq.title}</span>
              </div>
              {selectedReq.amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-black text-cyan text-sm">{naira(selectedReq.amount)}</span>
                </div>
              )}
            </div>

            {actionType === "approve" ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-foreground">
                  Enter 4-Digit Checker Security PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="field text-center font-mono text-xl tracking-widest"
                />
                <Button className="w-full bg-success text-white hover:bg-success/90" onClick={handleApprove}>
                  Confirm & Release Funds
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-foreground">
                  Reason for Rejection
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why this request is rejected..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="field w-full text-xs"
                />
                <Button variant="destructive" className="w-full" onClick={handleReject}>
                  Confirm Rejection
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
