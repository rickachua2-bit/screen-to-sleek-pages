import { useState } from "react";
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

const INITIAL_REQUESTS: ApprovalRequest[] = [
  {
    id: "APR-9102",
    reference: "REQ-TR-88120",
    title: "Treasury Sweep to External Bank",
    category: "treasury",
    makerName: "Tunde Bakare",
    makerRole: "Operations Lead",
    makerEmail: "tunde@merchant.com",
    amount: 5200000,
    recipient: "Zenith Bank · 1018294401 · Main Corporate",
    createdAt: "Today, 10:14 AM",
    thresholdTrigger: "Exceeds ₦1,000,000 Single Payout Policy",
    details: "Daily end-of-trade sweep of merchant POS float into corporate yield treasury.",
    status: "PENDING",
  },
  {
    id: "APR-9101",
    reference: "REQ-PAY-4412",
    title: "Monthly Operations Payroll Batch (18 Staff)",
    category: "payroll",
    makerName: "Amina Yusuf",
    makerRole: "HR & Payroll Specialist",
    makerEmail: "amina@merchant.com",
    amount: 3840000,
    recipient: "18 Nigerian Bank Accounts",
    createdAt: "Today, 08:30 AM",
    thresholdTrigger: "Exceeds ₦2,000,000 Batch Transfer Limit",
    details: "Salary disbursement for branch retail attendants and security crew.",
    status: "PENDING",
  },
  {
    id: "APR-9088",
    reference: "REQ-SEC-0912",
    title: "Production Webhook URL Update",
    category: "security",
    makerName: "David Okon",
    makerRole: "Lead Developer",
    makerEmail: "david@merchant.com",
    createdAt: "Yesterday, 4:20 PM",
    thresholdTrigger: "Critical API Security Configuration",
    details: "Changing event callback URL to https://api.slikmerchant.ng/v2/webhooks",
    status: "APPROVED",
    checkerName: "Boma Peters (Finance Director)",
    checkedAt: "Yesterday, 5:02 PM",
  },
  {
    id: "APR-9074",
    reference: "REQ-MAN-1192",
    title: "Manual Vendor Settlement Overwrite",
    category: "compliance",
    makerName: "Emeka Chidi",
    makerRole: "Finance Officer",
    makerEmail: "emeka@merchant.com",
    amount: 1450000,
    recipient: "Kuda Bank · 2001928410",
    createdAt: "Oct 26, 2:15 PM",
    thresholdTrigger: "Unverified Vendor Beneficiary",
    details: "Expedited contractor deposit for emergency branch generator repairs.",
    status: "REJECTED",
    checkerName: "Boma Peters (Finance Director)",
    checkedAt: "Oct 26, 3:30 PM",
    rejectionReason: "Incomplete CAC registration invoice. Vendor must submit approved purchase order.",
  },
];

export function ApprovalsManager() {
  const [tab, setTab] = useState<"pending" | "history" | "policies">("pending");
  const [requests, setRequests] = useState<ApprovalRequest[]>(INITIAL_REQUESTS);
  const [selectedReq, setSelectedReq] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [pin, setPin] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [policyThreshold, setPolicyThreshold] = useState("1000000");
  const [dualControlActive, setDualControlActive] = useState(true);

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
        <div className="flex items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-bold text-cyan">
          <ShieldCheck className="h-4 w-4" />
          Dual Control: {dualControlActive ? "Active (Strict)" : "Single Approval"}
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
              <p className="mt-1 text-[11px] text-muted-foreground">
                Any payout, transfer, or settlement higher than this sum automatically enters the Checker approval desk.
              </p>
            </div>

            <Button
              className="w-full"
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
            <p className="text-xs text-muted-foreground leading-relaxed">
              The following team roles possess Checker authorization privileges to sign off on queued actions:
            </p>

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

              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 p-3">
                <div>
                  <p className="font-bold text-foreground">Compliance Officer</p>
                  <p className="text-muted-foreground">Authorized for tier verification & vendor overrides</p>
                </div>
                <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-extrabold text-success">
                  Active
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-500">
              <strong>Notice:</strong> Makers cannot approve their own transactions under any circumstances.
            </div>
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maker:</span>
                <span className="text-foreground">{selectedReq.makerName} ({selectedReq.makerEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trigger Reason:</span>
                <span className="text-amber-500 font-bold">{selectedReq.thresholdTrigger}</span>
              </div>
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
                <p className="text-[11px] text-muted-foreground">
                  Your electronic signature and IP will be stamped to the immutable audit vault.
                </p>
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
                  placeholder="Explain why this request is rejected or what documentation is missing..."
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
