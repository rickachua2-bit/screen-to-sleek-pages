import { useState, useEffect } from "react";
import { 
  ArrowUpRight, Calendar, Check, CheckCircle2, ChevronRight, 
  Clock, DollarSign, Lock, PiggyBank, Plus, 
  RotateCcw, ShieldCheck, Sparkles, TrendingUp, Users, Wallet, X 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface TargetGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: string;
  autoSave: "daily" | "weekly" | "monthly" | "none";
}

interface LockedVault {
  id: string;
  title: string;
  principal: number;
  interestRate: number; // e.g. 14.5%
  maturityDate: string;
  daysRemaining: number;
  accruedInterest: number;
}

interface AjoCircle {
  id: string;
  name: string;
  contribution: number;
  frequency: "weekly" | "monthly";
  membersCount: number;
  currentTurn: string;
  mySlot: number;
  payoutDate: string;
  totalPool: number;
}

export function PersonalSavings() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"targets" | "vault" | "ajo">("targets");

  // State
  const [targets, setTargets] = useState<TargetGoal[]>(() => {
    try {
      const s = localStorage.getItem("slikpay_personal_targets");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [vaults, setVaults] = useState<LockedVault[]>(() => {
    try {
      const s = localStorage.getItem("slikpay_personal_vaults");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [circles, setCircles] = useState<AjoCircle[]>(() => {
    try {
      const s = localStorage.getItem("slikpay_personal_ajo");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  // Modals
  const [showNewTarget, setShowNewTarget] = useState(false);
  const [showNewVault, setShowNewVault] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<TargetGoal | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");

  // Form states for new target
  const [targetTitle, setTargetTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetAutoSave, setTargetAutoSave] = useState<"none" | "daily" | "weekly" | "monthly">("weekly");

  // Form states for new vault
  const [vaultTitle, setVaultTitle] = useState("");
  const [vaultAmount, setVaultAmount] = useState("");
  const [vaultDuration, setVaultDuration] = useState("90");

  useEffect(() => {
    try {
      localStorage.setItem("slikpay_personal_targets", JSON.stringify(targets));
    } catch {}
  }, [targets]);

  useEffect(() => {
    try {
      localStorage.setItem("slikpay_personal_vaults", JSON.stringify(vaults));
    } catch {}
  }, [vaults]);

  useEffect(() => {
    try {
      localStorage.setItem("slikpay_personal_ajo", JSON.stringify(circles));
    } catch {}
  }, [circles]);

  const totalTargetSaved = targets.reduce((acc, t) => acc + t.currentAmount, 0);
  const totalLockedVault = vaults.reduce((acc, v) => acc + v.principal, 0);
  const totalAccruedInterest = vaults.reduce((acc, v) => acc + v.accruedInterest, 0);
  const totalSavingsBalance = totalTargetSaved + totalLockedVault;

  const handleCreateTarget = () => {
    if (!targetTitle.trim() || !targetAmount) {
      toast.error("Please fill in the title and target amount");
      return;
    }
    const newTgt: TargetGoal = {
      id: `tgt-${Date.now()}`,
      title: targetTitle,
      targetAmount: Number(targetAmount),
      currentAmount: 0,
      deadline: targetDate || "Dec 31, 2026",
      category: "Personal Goal",
      autoSave: targetAutoSave,
    };
    setTargets((prev) => [newTgt, ...prev]);
    toast.success(`Target created: ${targetTitle}`, {
      description: `Target amount: ${naira(Number(targetAmount))}`,
    });
    setShowNewTarget(false);
    setTargetTitle("");
    setTargetAmount("");
    setTargetDate("");
  };

  const handleCreateVault = () => {
    if (!vaultAmount || Number(vaultAmount) <= 0) {
      toast.error("Please enter a deposit amount");
      return;
    }
    const days = Number(vaultDuration);
    const rate = days >= 365 ? 16.0 : days >= 180 ? 14.5 : days >= 90 ? 12.5 : 10.0;
    const newVlt: LockedVault = {
      id: `vlt-${Date.now()}`,
      title: vaultTitle || `SlikLock ${days}-Day Vault`,
      principal: Number(vaultAmount),
      interestRate: rate,
      maturityDate: `In ${days} days`,
      daysRemaining: days,
      accruedInterest: 0,
    };
    setVaults((prev) => [newVlt, ...prev]);
    toast.success(`Locked ${naira(Number(vaultAmount))} into SlikLock Vault`, {
      description: `Locked for ${days} days at ${rate}% p.a. guaranteed interest.`,
    });
    setShowNewVault(false);
    setVaultTitle("");
    setVaultAmount("");
  };

  const handleTopUpTarget = () => {
    if (!selectedTarget) return;
    const val = Number(topUpAmount);
    if (!val || val <= 0) {
      toast.error("Please enter an amount");
      return;
    }
    setTargets((prev) =>
      prev.map((t) => (t.id === selectedTarget.id ? { ...t, currentAmount: t.currentAmount + val } : t))
    );
    toast.success(`Saved ${naira(val)} to ${selectedTarget.title}`);
    setSelectedTarget(null);
    setTopUpAmount("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-cobalt" />
            Savings & SlikLock Wealth
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Automate goal savings, lock fixed funds up to 16% p.a., or rotate thrift pots with trusted Ajo circles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowNewTarget(true)}
            className="bg-cobalt text-white hover:bg-cobalt/90 font-bold"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Savings Goal
          </Button>
          <Button
            size="sm"
            onClick={() => setShowNewVault(true)}
            className="bg-gradient-to-r from-magenta to-indigo-600 text-white font-bold"
          >
            <Lock className="mr-1 h-3.5 w-3.5" />
            Lock Funds (14.5% p.a.)
          </Button>
        </div>
      </div>

      {/* Top Solvency & Yield Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Total Savings
          </span>
          <p className="mt-2 text-2xl font-black text-foreground">{naira(totalSavingsBalance)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Across all active plans</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Accrued Interest
          </span>
          <p className="mt-2 text-2xl font-black text-success">+{naira(totalAccruedInterest)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Compounding daily</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Peak Fixed APY
          </span>
          <p className="mt-2 text-2xl font-black text-magenta">16.0%</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Annualized NDIC backed</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Active Plans
          </span>
          <p className="mt-2 text-2xl font-black text-cyan">{targets.length + vaults.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Goals & fixed vaults</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("targets")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "targets"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Target Goals ({targets.length})
        </button>
        <button
          onClick={() => setTab("vault")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "vault"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-4 w-4" />
          SlikLock Fixed Vault ({vaults.length})
        </button>
        <button
          onClick={() => setTab("ajo")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "ajo"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Ajo Rotating Circles ({circles.length})
        </button>
      </div>

      {/* TAB 1: TARGET SAVINGS GOALS */}
      {tab === "targets" && (
        <div className="space-y-4">
          {targets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
              <PiggyBank className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <h3 className="text-base font-bold text-foreground">No Savings Goals Active</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Set a target for house rent, electronics, or travel and let Slikpay auto-save directly from your wallet.
              </p>
              <Button
                size="sm"
                className="mt-4 bg-cobalt text-white hover:bg-cobalt/90 font-bold"
                onClick={() => setShowNewTarget(true)}
              >
                Create First Goal
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {targets.map((tgt) => {
                const pct = Math.min(100, Math.round((tgt.currentAmount / tgt.targetAmount) * 100));
                return (
                  <div
                    key={tgt.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-cyan/40"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          {tgt.category}
                        </span>
                        {tgt.autoSave !== "none" && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-cyan">
                            <Sparkles className="h-3 w-3" />
                            Auto-Save ({tgt.autoSave})
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-extrabold text-foreground">{tgt.title}</h3>

                      <div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-lg font-black text-foreground">{naira(tgt.currentAmount)}</span>
                          <span className="text-xs text-muted-foreground">of {naira(tgt.targetAmount)}</span>
                        </div>

                        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-gradient-to-r from-cobalt to-cyan transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                          <span>{pct}% achieved</span>
                          <span>Target: {tgt.deadline}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-2 border-t border-border pt-4">
                      <Button
                        variant="crisp"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          setSelectedTarget(tgt);
                          setTopUpAmount("");
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add Money
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SLIKLOCK FIXED VAULT */}
      {tab === "vault" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-magenta/30 bg-gradient-to-r from-magenta/10 via-card to-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="flex items-center gap-2 text-sm font-extrabold text-magenta">
                <Lock className="h-4 w-4" />
                Guaranteed Up To 16% Per Annum
              </span>
              <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                Lock your funds away from impulse spending. Earn guaranteed returns paid daily into your locked vault with NDIC insured partner banks.
              </p>
            </div>
            <Button
              onClick={() => setShowNewVault(true)}
              className="bg-magenta text-white hover:bg-magenta/90 shrink-0 font-bold"
            >
              Lock New Funds
            </Button>
          </div>

          {vaults.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
              <Lock className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <h3 className="text-base font-bold text-foreground">No Funds Locked in SlikLock</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Earn industry-leading fixed returns locked for 30, 90, 180, or 365 days.
              </p>
              <Button
                size="sm"
                className="mt-4 bg-magenta text-white hover:bg-magenta/90 font-bold"
                onClick={() => setShowNewVault(true)}
              >
                Lock Funds (14.5% p.a.)
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {vaults.map((vlt) => (
                <div
                  key={vlt.id}
                  className="rounded-xl border border-border bg-card p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-foreground">{vlt.title}</h3>
                    <span className="rounded-full bg-magenta/15 px-2.5 py-0.5 text-xs font-black text-magenta">
                      {vlt.interestRate}% p.a.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/80 bg-background/50 p-3">
                    <div>
                      <span className="text-[11px] text-muted-foreground">Locked Principal</span>
                      <p className="text-lg font-black text-foreground">{naira(vlt.principal)}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground">Accrued Interest</span>
                      <p className="text-lg font-black text-success">+{naira(vlt.accruedInterest)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-cyan" />
                      {vlt.daysRemaining} days remaining
                    </span>
                    <span>Maturity: {vlt.maturityDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AJO ROTATING CIRCLES */}
      {tab === "ajo" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-cyan/30 bg-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="flex items-center gap-2 text-sm font-extrabold text-cyan">
                <Users className="h-4 w-4" />
                Zero-Default Digital Ajo Engine
              </span>
              <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                Save collaboratively with friends or verified colleagues. Automated direct-debits ensure everyone contributes on time, eliminating collection awkwardness.
              </p>
            </div>
            <Button
              className="bg-cyan text-slate-950 font-bold hover:bg-cyan/90 shrink-0"
              onClick={() => toast.info("Ajo circle invitations will appear here as friends invite you.")}
            >
              Start New Circle
            </Button>
          </div>

          {circles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <h3 className="text-base font-bold text-foreground">No Active Ajo Circles</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Join a rotating thrift club with friends or colleagues to pool funds with zero risk of defaults.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {circles.map((ajo) => (
                <div
                  key={ajo.id}
                  className="rounded-xl border border-border bg-card p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-foreground">{ajo.name}</h3>
                    <span className="rounded bg-cyan/15 px-2 py-0.5 text-xs font-bold text-cyan">
                      {ajo.frequency}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/80 bg-background/50 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Contribution</span>
                      <p className="text-base font-black text-foreground">{naira(ajo.contribution)} / mo</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Payout Pool</span>
                      <p className="text-base font-black text-cyan">{naira(ajo.totalPool)}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Current Round Recipient:</span>
                      <span className="font-bold text-foreground">{ajo.currentTurn}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Your Scheduled Slot:</span>
                      <span className="font-extrabold text-success">Slot #{ajo.mySlot} · {ajo.payoutDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NEW TARGET MODAL */}
      {showNewTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setShowNewTarget(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-cobalt" />
                Create Savings Goal
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowNewTarget(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground">Goal Title</label>
                <input
                  placeholder="e.g. Rent 2027, New Laptop, Wedding"
                  value={targetTitle}
                  onChange={(e) => setTargetTitle(e.target.value)}
                  className="field mt-1.5 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Target Amount (NGN)</label>
                <input
                  type="number"
                  placeholder="e.g. 500000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="field mt-1.5 w-full text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Target Target Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="field mt-1.5 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Auto-Save Schedule</label>
                <select
                  value={targetAutoSave}
                  onChange={(e) => setTargetAutoSave(e.target.value as any)}
                  className="field mt-1.5 w-full text-xs"
                >
                  <option value="none">Manual deposits only</option>
                  <option value="daily">Save daily automatically</option>
                  <option value="weekly">Save every Monday</option>
                  <option value="monthly">Save monthly on payday</option>
                </select>
              </div>

              <Button className="w-full bg-cobalt text-white hover:bg-cobalt/90 font-bold" onClick={handleCreateTarget}>
                Start Saving
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* NEW VAULT MODAL */}
      {showNewVault && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setShowNewVault(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Lock className="h-5 w-5 text-magenta" />
                Lock Funds in SlikLock
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowNewVault(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground">Vault Title (Optional)</label>
                <input
                  placeholder="e.g. 6-Month High Yield Lock"
                  value={vaultTitle}
                  onChange={(e) => setVaultTitle(e.target.value)}
                  className="field mt-1.5 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Amount to Lock (NGN)</label>
                <input
                  type="number"
                  placeholder="e.g. 250000"
                  value={vaultAmount}
                  onChange={(e) => setVaultAmount(e.target.value)}
                  className="field mt-1.5 w-full text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Lock Tenure & APY</label>
                <select
                  value={vaultDuration}
                  onChange={(e) => setVaultDuration(e.target.value)}
                  className="field mt-1.5 w-full text-xs font-bold"
                >
                  <option value="30">30 Days · 10.0% p.a.</option>
                  <option value="90">90 Days · 12.5% p.a.</option>
                  <option value="180">180 Days · 14.5% p.a. (Recommended)</option>
                  <option value="365">365 Days · 16.0% p.a. (Maximum APY)</option>
                </select>
              </div>

              <div className="rounded-lg border border-magenta/20 bg-magenta/10 p-3 text-[11px] text-magenta">
                <strong>Important:</strong> Locked funds cannot be broken before maturity date to safeguard your promised high-yield return.
              </div>

              <Button className="w-full bg-magenta text-white hover:bg-magenta/90 font-bold" onClick={handleCreateVault}>
                Lock & Earn Yield
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TOP UP TARGET MODAL */}
      {selectedTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setSelectedTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Save to {selectedTarget.title}</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedTarget(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground">Amount to Save (NGN)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="field mt-1.5 w-full text-sm font-mono"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Debited instantly from your available wallet balance.
                </span>
              </div>

              <Button className="w-full bg-cobalt text-white font-bold hover:bg-cobalt/90" onClick={handleTopUpTarget}>
                Deposit into Goal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
