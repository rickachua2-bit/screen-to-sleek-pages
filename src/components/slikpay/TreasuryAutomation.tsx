import { useState } from "react";
import { 
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Award, 
  Building2, CheckCircle2, ChevronRight, Clock, 
  DollarSign, Download, FileText, Globe, Landmark, 
  Layers, Lock, PiggyBank, Plus, RefreshCw, 
  ShieldCheck, Sparkles, TrendingUp, Wallet, X 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";

interface VirtualPocket {
  id: string;
  name: string;
  purpose: string;
  balance: number;
  target?: number;
  color: string;
}

const INITIAL_POCKETS: VirtualPocket[] = [
  {
    id: "pkt-tax",
    name: "FIRS VAT & Withholding Tax",
    purpose: "Dedicated statutory reserve for quarterly tax filings",
    balance: 1450000,
    target: 2000000,
    color: "from-blue-600 to-indigo-600",
  },
  {
    id: "pkt-payroll",
    name: "Staff Payroll Reserve",
    purpose: "Locked salaries for 18 staff disbursed on 28th",
    balance: 3840000,
    target: 4000000,
    color: "from-emerald-600 to-teal-600",
  },
  {
    id: "pkt-capex",
    name: "POS & Hardware Fleet Expansion",
    purpose: "Capital allocation for new SmartTag standees & terminals",
    balance: 850000,
    target: 1500000,
    color: "from-purple-600 to-pink-600",
  },
];

export function TreasuryAutomation() {
  const [tab, setTab] = useState<"liquidity" | "pockets" | "sweep" | "certificate">("liquidity");

  // Balances
  const [spendFloat, setSpendFloat] = useState(6450000);
  const [vaultReserves, setVaultReserves] = useState(18500000);
  const [usdBalance, setUsdBalance] = useState(14820);
  const [gbpBalance, setGbpBalance] = useState(4200);

  // Virtual Pockets
  const [pockets, setPockets] = useState<VirtualPocket[]>(INITIAL_POCKETS);
  const [newPocketName, setNewPocketName] = useState("");
  const [newPocketPurpose, setNewPocketPurpose] = useState("");
  const [newPocketTarget, setNewPocketTarget] = useState("");
  const [showNewPocketModal, setShowNewPocketModal] = useState(false);

  // Allocation Modal
  const [selectedPocket, setSelectedPocket] = useState<VirtualPocket | null>(null);
  const [allocateAmount, setAllocateAmount] = useState("");
  const [allocDirection, setAllocDirection] = useState<"to_pocket" | "from_pocket">("to_pocket");

  // Book Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDir, setTransferDir] = useState<"to_vault" | "to_float">("to_vault");

  // Sweep Rules
  const [sweepActive, setSweepActive] = useState(true);
  const [sweepThreshold, setSweepThreshold] = useState("2000000");
  const [sweepBank, setSweepBank] = useState("Zenith Bank · 1018294401 (Main Treasury)");
  const [sweepSchedule, setSweepSchedule] = useState("17:00 (End of Business Day)");

  const totalPocketsBalance = pockets.reduce((acc, p) => acc + p.balance, 0);
  const totalNgnSolvency = spendFloat + vaultReserves + totalPocketsBalance;

  const handleBookTransfer = () => {
    const val = Number(transferAmount);
    if (!val || val <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (transferDir === "to_vault") {
      if (val > spendFloat) {
        toast.error("Insufficient T+0 Spend Float");
        return;
      }
      setSpendFloat((prev) => prev - val);
      setVaultReserves((prev) => prev + val);
      toast.success(`Transferred ${naira(val)} to Treasury Vault Reserves`, {
        description: "Funds moved to high-yield 11.5% p.a. escrow.",
      });
    } else {
      if (val > vaultReserves) {
        toast.error("Insufficient Vault Reserves");
        return;
      }
      setVaultReserves((prev) => prev - val);
      setSpendFloat((prev) => prev + val);
      toast.success(`Released ${naira(val)} into T+0 Spend Float`, {
        description: "Available immediately for disbursements and payouts.",
      });
    }
    setShowTransferModal(false);
    setTransferAmount("");
  };

  const handleCreatePocket = () => {
    if (!newPocketName.trim()) {
      toast.error("Please enter a pocket name");
      return;
    }
    const newPkt: VirtualPocket = {
      id: `pkt-${Date.now()}`,
      name: newPocketName,
      purpose: newPocketPurpose || "Dedicated sub-pocket allocation",
      balance: 0,
      target: newPocketTarget ? Number(newPocketTarget) : undefined,
      color: "from-cyan-600 to-blue-600",
    };
    setPockets((prev) => [...prev, newPkt]);
    toast.success(`Created Virtual Pocket: ${newPocketName}`);
    setShowNewPocketModal(false);
    setNewPocketName("");
    setNewPocketPurpose("");
    setNewPocketTarget("");
  };

  const handleAllocate = () => {
    if (!selectedPocket) return;
    const val = Number(allocateAmount);
    if (!val || val <= 0) {
      toast.error("Please enter an amount");
      return;
    }
    if (allocDirection === "to_pocket") {
      if (val > spendFloat) {
        toast.error("Insufficient spend float");
        return;
      }
      setSpendFloat((prev) => prev - val);
      setPockets((prev) =>
        prev.map((p) => (p.id === selectedPocket.id ? { ...p, balance: p.balance + val } : p))
      );
      toast.success(`Allocated ${naira(val)} to ${selectedPocket.name}`);
    } else {
      if (val > selectedPocket.balance) {
        toast.error("Pocket does not have enough funds");
        return;
      }
      setPockets((prev) =>
        prev.map((p) => (p.id === selectedPocket.id ? { ...p, balance: p.balance - val } : p))
      );
      setSpendFloat((prev) => prev + val);
      toast.success(`Released ${naira(val)} back to Spend Float`);
    }
    setSelectedPocket(null);
    setAllocateAmount("");
  };

  const handleExecuteSweepNow = () => {
    const sweepAmt = Math.max(0, spendFloat - Number(sweepThreshold));
    if (sweepAmt <= 0) {
      toast.info("Float is already below sweep threshold. No sweep necessary.");
      return;
    }
    setSpendFloat((prev) => prev - sweepAmt);
    toast.success(`Auto-Sweep Dispatched: ${naira(sweepAmt)}`, {
      description: `Settled into ${sweepBank}. Clearing reference NIBSS-${Date.now().toString().slice(-8)}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <Landmark className="h-6 w-6 text-cyan" />
            Treasury & Institutional Liquidity
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Atomic liquidity desk: manage T+0 float, 11.5% yield reserves, virtual pockets, and automated external bank sweeps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTransferModal(true)}
            className="border-cyan/40 text-cyan hover:bg-cyan/10"
          >
            <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
            Book Transfer (Float ⇄ Vault)
          </Button>
          <Button
            size="sm"
            onClick={() => setTab("certificate")}
            className="bg-cobalt text-white hover:bg-cobalt/90"
          >
            <Award className="mr-1.5 h-3.5 w-3.5" />
            Balance Certificate
          </Button>
        </div>
      </div>

      {/* Liquidity High-Level Summary Card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* NGN Solvency */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-card/60 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total NGN Solvency
            </span>
            <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
              <TrendingUp className="h-3 w-3" />
              11.5% Yield Active
            </span>
          </div>
          <div className="mt-4 text-3xl font-black text-foreground">
            {naira(totalNgnSolvency)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Float ({naira(spendFloat)}) + Vault ({naira(vaultReserves)}) + Pockets ({naira(totalPocketsBalance)})
          </p>
        </div>

        {/* T+0 Spend Float */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              T+0 Available Spend Float
            </span>
            <Wallet className="h-4 w-4 text-cyan" />
          </div>
          <div className="mt-4 text-3xl font-black text-cyan">
            {naira(spendFloat)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Instant settlement & automated payout ceiling
          </p>
        </div>

        {/* Foreign Currency Reserves */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Multi-Currency Reserves
            </span>
            <Globe className="h-4 w-4 text-cobalt" />
          </div>
          <div className="mt-3 flex items-baseline gap-4">
            <div>
              <span className="text-xs text-muted-foreground">USD Domiciliary</span>
              <p className="text-xl font-black text-foreground">${usdBalance.toLocaleString()}</p>
            </div>
            <div className="border-l border-border pl-4">
              <span className="text-xs text-muted-foreground">GBP Global</span>
              <p className="text-xl font-black text-foreground">£{gbpBalance.toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            CBN FMDQ Interbank Clearing Rail
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("liquidity")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "liquidity"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Float & Vault Allocation
        </button>
        <button
          onClick={() => setTab("pockets")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "pockets"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" />
          Virtual Envelope Pockets ({pockets.length})
        </button>
        <button
          onClick={() => setTab("sweep")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "sweep"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Sentinel Auto-Sweep
        </button>
        <button
          onClick={() => setTab("certificate")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "certificate"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          Certified Proof of Funds
        </button>
      </div>

      {/* TAB 1: LIQUIDITY (FLOAT & VAULT) */}
      {tab === "liquidity" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Spend Float Card */}
          <div className="space-y-4 rounded-xl border border-cyan/30 bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                <Wallet className="h-5 w-5 text-cyan" />
                Operational Spend Float
              </span>
              <span className="rounded bg-cyan/15 px-2 py-0.5 text-xs font-bold text-cyan">
                T+0 Immediate
              </span>
            </div>

            <div className="text-3xl font-black text-foreground">{naira(spendFloat)}</div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This pool covers instant POS payouts, customer refunds, NIP transfers, and corporate debit card spending. It is cleared real-time with zero lockup.
            </p>

            <div className="rounded-lg border border-border bg-background/50 p-3 text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Daily Outbound Payout Limit:</span>
                <span className="font-bold text-foreground">₦25,000,000</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Liquidity Coverage Ratio:</span>
                <span className="font-bold text-success">385% (Healthy)</span>
              </div>
            </div>

            <Button
              className="w-full bg-cyan/20 text-cyan hover:bg-cyan/30"
              onClick={() => {
                setTransferDir("to_vault");
                setShowTransferModal(true);
              }}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              Lock Excess Float into Vault Reserve
            </Button>
          </div>

          {/* Treasury Vault Card */}
          <div className="space-y-4 rounded-xl border border-cobalt/30 bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                <PiggyBank className="h-5 w-5 text-cobalt" />
                Treasury Vault Reserves
              </span>
              <span className="rounded bg-cobalt/15 px-2 py-0.5 text-xs font-bold text-cobalt">
                11.5% p.a. Compounding
              </span>
            </div>

            <div className="text-3xl font-black text-foreground">{naira(vaultReserves)}</div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Surplus merchant liquidity placed in overnight FGN Treasury Bills and institutional money market assets. Accrues yield daily directly to your ledger.
            </p>

            <div className="rounded-lg border border-border bg-background/50 p-3 text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Accrued Yield This Month:</span>
                <span className="font-bold text-success">₦174,210</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Liquidity Settlement Rail:</span>
                <span className="font-bold text-foreground">CBN T+3 Instant Liquidation</span>
              </div>
            </div>

            <Button
              className="w-full bg-cobalt text-white hover:bg-cobalt/90"
              onClick={() => {
                setTransferDir("to_float");
                setShowTransferModal(true);
              }}
            >
              <ArrowDownLeft className="mr-1.5 h-3.5 w-3.5" />
              Liquidate to T+0 Spend Float
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: VIRTUAL ENVELOPE POCKETS */}
      {tab === "pockets" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Virtual pockets isolate funds for tax, payroll, or capex so they are never accidentally spent during day-to-day operations.
            </p>
            <Button
              size="sm"
              onClick={() => setShowNewPocketModal(true)}
              className="bg-cyan text-slate-950 font-bold hover:bg-cyan/90"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Pocket
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pockets.map((pkt) => {
              const pct = pkt.target ? Math.min(100, Math.round((pkt.balance / pkt.target) * 100)) : 100;
              return (
                <div
                  key={pkt.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-foreground">{pkt.name}</span>
                      <span className="text-xs font-mono font-bold text-cyan">{naira(pkt.balance)}</span>
                    </div>

                    <p className="text-xs text-muted-foreground">{pkt.purpose}</p>

                    {pkt.target && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Target: {naira(pkt.target)}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-cyan transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        setSelectedPocket(pkt);
                        setAllocDirection("to_pocket");
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Allocate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        setSelectedPocket(pkt);
                        setAllocDirection("from_pocket");
                      }}
                    >
                      <ArrowUpRight className="mr-1 h-3 w-3" />
                      Release
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SENTINEL AUTO-SWEEP */}
      {tab === "sweep" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan" />
              Automated Bank Sweeps
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Protect your merchant revenues and streamline accounting. The Sentinel engine automatically moves funds above your target threshold to your primary bank account at the close of every business day.
            </p>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-bold text-foreground">Enable Sentinel Auto-Sweep</p>
                <p className="text-xs text-muted-foreground">Triggered on schedule or when threshold breached</p>
              </div>
              <input
                type="checkbox"
                checked={sweepActive}
                onChange={(e) => {
                  setSweepActive(e.target.checked);
                  toast.success(
                    e.target.checked ? "Auto-sweep rules enabled" : "Auto-sweep paused"
                  );
                }}
                className="h-5 w-5 accent-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground">
                Retain Float Threshold (NGN)
              </label>
              <select
                value={sweepThreshold}
                onChange={(e) => setSweepThreshold(e.target.value)}
                className="field mt-1.5 w-full text-sm"
              >
                <option value="500000">₦500,000 (Sweep everything over ₦500k)</option>
                <option value="1000000">₦1,000,000 (Sweep everything over ₦1M)</option>
                <option value="2000000">₦2,000,000 (Sweep everything over ₦2M)</option>
                <option value="5000000">₦5,000,000 (Sweep everything over ₦5M)</option>
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                All receipts exceeding this amount will be automatically transferred out.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground">
                Destination Commercial Bank Account
              </label>
              <select
                value={sweepBank}
                onChange={(e) => setSweepBank(e.target.value)}
                className="field mt-1.5 w-full text-sm"
              >
                <option value="Zenith Bank · 1018294401 (Main Treasury)">
                  Zenith Bank · 1018294401 · Main Corporate Treasury
                </option>
                <option value="Access Bank · 0092817263 (Operating)">
                  Access Bank · 0092817263 · Operating Account
                </option>
                <option value="GTBank · 0129847162 (Tax Reserve)">
                  GTBank · 0129847162 · Statutory Holding
                </option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                onClick={() => toast.success("Auto-sweep rules updated successfully")}
              >
                Save Sweep Settings
              </Button>
              <Button
                variant="outline"
                className="border-cyan/40 text-cyan hover:bg-cyan/10"
                onClick={handleExecuteSweepNow}
              >
                Sweep Now
              </Button>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-cobalt" />
              Recent Sweep Telemetry
            </h2>
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-border/70 bg-background/50 p-3 space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>Zenith Bank Payout</span>
                  <span className="text-success">+₦3,410,000</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Yesterday at 17:00 · Sentinel Daily Batch</span>
                  <span className="text-success font-semibold">NIBSS Cleared</span>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/50 p-3 space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>Zenith Bank Payout</span>
                  <span className="text-success">+₦4,120,000</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Oct 27 at 17:00 · Sentinel Daily Batch</span>
                  <span className="text-success font-semibold">NIBSS Cleared</span>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/50 p-3 space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>Zenith Bank Payout</span>
                  <span className="text-success">+₦2,890,000</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Oct 26 at 17:00 · Sentinel Daily Batch</span>
                  <span className="text-success font-semibold">NIBSS Cleared</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CERTIFIED PROOF OF FUNDS */}
      {tab === "certificate" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-2xl border border-cyan/40 bg-card p-8 shadow-xl relative overflow-hidden">
            {/* Watermark / Seal */}
            <div className="flex items-center justify-between border-b border-border pb-6">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan">
                  Central Bank of Nigeria (CBN) · PSP Category
                </span>
                <h2 className="text-xl font-black text-foreground mt-1">
                  OFFICIAL BALANCE CERTIFICATE
                </h2>
                <p className="text-xs text-muted-foreground">
                  Reference: CERT-SLK-{Date.now().toString().slice(-8)}
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan/40 bg-cyan/10 text-cyan">
                <ShieldCheck className="h-8 w-8" />
              </div>
            </div>

            <div className="my-6 space-y-4 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                This is to certify that as of <strong className="text-foreground">{new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}</strong>, the corporate merchant maintains the following verified institutional ledger balances cleared through Slikpay BaaS and Partner Settlement Banks:
              </p>

              <div className="rounded-xl border border-border bg-background/60 p-4 space-y-2">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Available T+0 Spend Float:</span>
                  <span className="font-mono font-bold text-foreground">{naira(spendFloat)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Treasury Vault Yield Reserves:</span>
                  <span className="font-mono font-bold text-foreground">{naira(vaultReserves)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Dedicated Virtual Envelope Reserves:</span>
                  <span className="font-mono font-bold text-foreground">{naira(totalPocketsBalance)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-sm">
                  <span className="text-foreground">Total NGN Liquid Net Worth:</span>
                  <span className="font-mono text-cyan text-base">{naira(totalNgnSolvency)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-[11px] text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Cryptographic Verification Seal</p>
                  <p className="font-mono text-[10px] break-all">
                    SHA256: 7f8a9e01b34c56d7890ef123456789abcdeffedcba9876543210
                  </p>
                </div>
                <span className="rounded bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
                  CBN Verified Solvency
                </span>
              </div>
            </div>

            <div className="border-t border-border pt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="text-xs"
              >
                Print Official Certificate
              </Button>
              <Button
                size="sm"
                className="bg-cyan text-slate-950 font-bold hover:bg-cyan/90 text-xs"
                onClick={() => {
                  toast.success("Certified PDF generated and downloaded", {
                    description: "Ready for submission to auditors, embassies, or tenders.",
                  });
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download PDF Certificate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* BOOK TRANSFER MODAL (FLOAT <-> VAULT) */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-cyan" />
                Treasury Book Transfer
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowTransferModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Atomic double-entry transfer between your operational float and yield-bearing vault reserves.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferDir("to_vault")}
                  className={`rounded-lg border p-3 text-center text-xs font-bold transition-all ${
                    transferDir === "to_vault"
                      ? "border-cyan bg-cyan/15 text-cyan"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  Float → Vault Reserve
                </button>
                <button
                  type="button"
                  onClick={() => setTransferDir("to_float")}
                  className={`rounded-lg border p-3 text-center text-xs font-bold transition-all ${
                    transferDir === "to_float"
                      ? "border-cyan bg-cyan/15 text-cyan"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  Vault Reserve → Float
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">
                  Transfer Amount (NGN)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="field mt-1.5 w-full text-base font-mono"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Available in source:{" "}
                  <strong>
                    {transferDir === "to_vault" ? naira(spendFloat) : naira(vaultReserves)}
                  </strong>
                </span>
              </div>

              <Button className="w-full bg-cyan text-slate-950 font-bold hover:bg-cyan/90" onClick={handleBookTransfer}>
                Execute Atomic Transfer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW POCKET MODAL */}
      {showNewPocketModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setShowNewPocketModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Plus className="h-5 w-5 text-cyan" />
                Create Virtual Pocket
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowNewPocketModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground">Pocket Name</label>
                <input
                  placeholder="e.g. Q4 Tax Reserve, Generator Capex"
                  value={newPocketName}
                  onChange={(e) => setNewPocketName(e.target.value)}
                  className="field mt-1.5 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Purpose Description</label>
                <input
                  placeholder="e.g. Reserved for statutory corporate compliance"
                  value={newPocketPurpose}
                  onChange={(e) => setNewPocketPurpose(e.target.value)}
                  className="field mt-1.5 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Target Amount (Optional, NGN)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000000"
                  value={newPocketTarget}
                  onChange={(e) => setNewPocketTarget(e.target.value)}
                  className="field mt-1.5 w-full text-xs"
                />
              </div>

              <Button className="w-full" onClick={handleCreatePocket}>
                Create Pocket
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ALLOCATE / RELEASE POCKET MODAL */}
      {selectedPocket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setSelectedPocket(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {allocDirection === "to_pocket" ? "Allocate to" : "Release from"}{" "}
                {selectedPocket.name}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedPocket(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground">Amount (NGN)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={allocateAmount}
                  onChange={(e) => setAllocateAmount(e.target.value)}
                  className="field mt-1.5 w-full text-sm font-mono"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {allocDirection === "to_pocket"
                    ? `Available in Spend Float: ${naira(spendFloat)}`
                    : `Available in Pocket: ${naira(selectedPocket.balance)}`}
                </span>
              </div>

              <Button className="w-full" onClick={handleAllocate}>
                Confirm Transfer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
