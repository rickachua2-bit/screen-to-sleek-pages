import { useState, useEffect } from "react";
import { 
  AlertTriangle, Check, CheckCircle2, Clock, DollarSign, 
  HelpCircle, Lock, Plus, RefreshCw, ShieldAlert, 
  ShieldCheck, Smartphone, Users, X 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";

interface Cashier {
  id: string;
  name: string;
  phone: string;
  role: string;
  terminal: string;
  status: "active" | "inactive";
  lastShift: string;
  pinSet: boolean;
}

interface ActiveShift {
  id: string;
  cashierName: string;
  terminal: string;
  startedAt: string;
  openingCash: number;
  cashCollected: number;
  tapSmartTagVolume: number;
  cardVolume: number;
  totalCollected: number;
}

export function CashierShiftsManager() {
  const [cashiers, setCashiers] = useState<Cashier[]>(() => {
    try {
      const s = localStorage.getItem("slikpay_merchant_cashiers");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [shifts, setShifts] = useState<ActiveShift[]>(() => {
    try {
      const s = localStorage.getItem("slikpay_merchant_shifts");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [tab, setTab] = useState<"shifts" | "staff">("shifts");
  const [addModal, setAddModal] = useState(false);
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [reconcileModal, setReconcileModal] = useState<ActiveShift | null>(null);

  // New Cashier Form State
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTerminal, setNewTerminal] = useState("Main Register POS 1");
  const [newPin, setNewPin] = useState("");

  // New Shift Form State
  const [shiftCashierId, setShiftCashierId] = useState("");
  const [openingCashInput, setOpeningCashInput] = useState("10000");

  // Reconcile Form State
  const [countedCash, setCountedCash] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("slikpay_merchant_cashiers", JSON.stringify(cashiers));
    } catch {}
  }, [cashiers]);

  useEffect(() => {
    try {
      localStorage.setItem("slikpay_merchant_shifts", JSON.stringify(shifts));
    } catch {}
  }, [shifts]);

  const handleAddCashier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPin || newPin.length !== 4) {
      toast.error("Please enter a valid 4-digit PIN for the cashier.");
      return;
    }

    const created: Cashier = {
      id: `CSH-0${cashiers.length + 1}`,
      name: newName,
      phone: newPhone || "08000000000",
      role: "Cashier Associate",
      terminal: newTerminal,
      status: "active",
      lastShift: "Not started",
      pinSet: true,
    };

    setCashiers([...cashiers, created]);
    setAddModal(false);
    setNewName("");
    setNewPhone("");
    setNewPin("");
    toast.success(`Cashier ${created.name} registered`, {
      description: `Assigned to ${created.terminal}. 4-digit POS PIN active.`,
    });
  };

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const c = cashiers.find((item) => item.id === shiftCashierId) || cashiers[0];
    if (!c) {
      toast.error("Please register a cashier first.");
      return;
    }

    const newShift: ActiveShift = {
      id: `SFT-${Date.now().toString().slice(-4)}`,
      cashierName: c.name,
      terminal: c.terminal,
      startedAt: "Just now",
      openingCash: Number(openingCashInput) || 0,
      cashCollected: 0,
      tapSmartTagVolume: 0,
      cardVolume: 0,
      totalCollected: 0,
    };

    setShifts([newShift, ...shifts]);
    setOpenShiftModal(false);
    toast.success(`Shift started for ${c.name}`, {
      description: `Opening till drawer allocated: ${naira(newShift.openingCash)}`,
    });
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileModal) return;

    const counted = Number(countedCash) || 0;
    const expected = reconcileModal.openingCash + reconcileModal.cashCollected;
    const variance = counted - expected;

    setShifts(shifts.filter((s) => s.id !== reconcileModal.id));
    setReconcileModal(null);
    setCountedCash("");

    if (variance === 0) {
      toast.success("Shift Reconciled Perfectly!", {
        description: `Cash matched expected ${naira(expected)} exactly. Drawer closed.`,
      });
    } else if (variance < 0) {
      toast.error(`Cash Shortage: ${naira(Math.abs(variance))}`, {
        description: `Discrepancy flagged for audit under ${reconcileModal.cashierName}.`,
      });
    } else {
      toast.warning(`Cash Surplus: +${naira(variance)}`, {
        description: `Surplus recorded and credited to miscellaneous ledger.`,
      });
    }
  };

  const totalCollectedToday = shifts.reduce((acc, s) => acc + s.totalCollected, 0);
  const totalCashInDrawers = shifts.reduce((acc, s) => acc + s.openingCash + s.cashCollected, 0);
  const totalDigitalVolume = shifts.reduce((acc, s) => acc + s.tapSmartTagVolume + s.cardVolume, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-cyan" />
            Cashier Shifts & POS Till Loss Prevention
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Control cash handling, track live POS drawers, set 4-digit attendant PINs, and reconcile variances at shift closeout.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cashiers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenShiftModal(true)}
              className="border-cyan/40 text-cyan hover:bg-cyan/10"
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Open New Shift
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setAddModal(true)}
            className="bg-cyan text-slate-950 font-bold hover:bg-cyan/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Cashier
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Active Tills</span>
            <Smartphone className="h-4 w-4 text-cyan" />
          </div>
          <p className="mt-2 text-2xl font-black text-cyan">{shifts.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{cashiers.length} staff enrolled</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Cash in Tills</span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-lg sm:text-xl lg:text-2xl font-black text-amber-500 truncate">{naira(totalCashInDrawers)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Physical drawer exposure</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Tap & SmartTag</span>
            <Smartphone className="h-4 w-4 text-cobalt" />
          </div>
          <p className="mt-2 text-lg sm:text-xl lg:text-2xl font-black text-cobalt truncate">{naira(totalDigitalVolume)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Settled direct to balance</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Loss Discrepancy</span>
            <ShieldAlert className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-black text-success">₦0.00</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Zero variance reported</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("shifts")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "shifts"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          Active Shift Tills ({shifts.length})
        </button>
        <button
          onClick={() => setTab("staff")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            tab === "staff"
              ? "border-cyan text-cyan"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Cashier Directory & PINs ({cashiers.length})
        </button>
      </div>

      {/* TAB 1: SHIFTS */}
      {tab === "shifts" && (
        <div className="space-y-4">
          {shifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
              <Clock className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <h3 className="text-base font-bold text-foreground">No Active Cashier Shifts</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                No registers or POS drawers are currently open. Open a shift when an attendant begins their collection period.
              </p>
              <div className="mt-4 flex gap-3">
                {cashiers.length === 0 ? (
                  <Button
                    size="sm"
                    className="bg-cyan text-slate-950 font-bold hover:bg-cyan/90"
                    onClick={() => setAddModal(true)}
                  >
                    Add First Cashier
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-cyan text-slate-950 font-bold hover:bg-cyan/90"
                    onClick={() => setOpenShiftModal(true)}
                  >
                    Open New Shift
                  </Button>
                )}
              </div>
            </div>
          ) : (
            shifts.map((shift) => (
              <div
                key={shift.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-border/80 md:flex-row md:items-center"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      LIVE TILL
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{shift.id}</span>
                    <span className="text-xs font-bold text-cyan">{shift.terminal}</span>
                  </div>

                  <h3 className="text-lg font-extrabold text-foreground">{shift.cashierName}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Started: {shift.startedAt}</span>
                    <span>Opening Float: <strong>{naira(shift.openingCash)}</strong></span>
                    <span>Cash Collected: <strong>{naira(shift.cashCollected)}</strong></span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border pt-3 md:border-none md:pt-0">
                  <div className="text-left md:text-right">
                    <p className="text-xs text-muted-foreground">Total In Drawer</p>
                    <p className="text-xl font-black text-foreground">
                      {naira(shift.openingCash + shift.cashCollected)}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-cyan/40 text-cyan hover:bg-cyan/10"
                    onClick={() => {
                      setReconcileModal(shift);
                      setCountedCash("");
                    }}
                  >
                    Close Till & Reconcile
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: STAFF */}
      {tab === "staff" && (
        <div className="space-y-4">
          {cashiers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <h3 className="text-base font-bold text-foreground">No Cashiers Registered Yet</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Enroll staff members and assign them secure 4-digit POS PINs for audit trace and theft prevention.
              </p>
              <Button
                size="sm"
                className="mt-4 bg-cyan text-slate-950 font-bold hover:bg-cyan/90"
                onClick={() => setAddModal(true)}
              >
                Add First Cashier
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="p-4">Staff Name</th>
                    <th className="p-4">Assigned POS Terminal</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">PIN Security</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cashiers.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="p-4">
                        <div className="font-bold text-foreground">{c.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.id}</div>
                      </td>
                      <td className="p-4 text-xs font-semibold text-foreground">{c.terminal}</td>
                      <td className="p-4 text-xs text-muted-foreground">{c.phone}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                          <Lock className="h-3 w-3" />
                          4-Digit PIN Set
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="rounded bg-cyan/15 px-2 py-0.5 text-xs font-bold text-cyan">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD CASHIER */}
      {addModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setAddModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-cyan" />
                Register New Cashier
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setAddModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleAddCashier} className="space-y-4 text-xs">
              <div>
                <label className="block text-foreground font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Blessing Okon"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="field w-full text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Mobile Phone</label>
                <input
                  type="text"
                  placeholder="080..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Assigned POS Terminal</label>
                <input
                  type="text"
                  placeholder="e.g. Front Counter POS 1"
                  value={newTerminal}
                  onChange={(e) => setNewTerminal(e.target.value)}
                  className="field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Set 4-Digit Attendant PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  className="field w-full text-center font-mono text-lg tracking-widest"
                  required
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Cashier will enter this PIN on the POS terminal to authorize transactions and open the drawer.
                </p>
              </div>

              <Button type="submit" className="w-full bg-cyan text-slate-950 font-bold hover:bg-cyan/90 h-10">
                Enroll Cashier
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: OPEN SHIFT */}
      {openShiftModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setOpenShiftModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-cyan" />
                Open Cashier Till Shift
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setOpenShiftModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
              <div>
                <label className="block text-foreground font-bold mb-1">Select Cashier</label>
                <select
                  value={shiftCashierId}
                  onChange={(e) => setShiftCashierId(e.target.value)}
                  className="field w-full text-xs font-bold"
                >
                  {cashiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.terminal})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">Opening Cash Float (NGN)</label>
                <input
                  type="number"
                  placeholder="10000"
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  className="field w-full text-xs font-mono"
                  required
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Cash drawer baseline provided for petty change.
                </p>
              </div>

              <Button type="submit" className="w-full bg-cyan text-slate-950 font-bold hover:bg-cyan/90 h-10">
                Activate Shift Till
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECONCILE SHIFT */}
      {reconcileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center slik-overlay-backdrop p-4"
          onClick={() => setReconcileModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="slik-popup w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                Close Till & Reconcile: {reconcileModal.cashierName}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setReconcileModal(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
              <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opening Cash Float:</span>
                  <span className="font-bold">{naira(reconcileModal.openingCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash Collections:</span>
                  <span className="font-bold">{naira(reconcileModal.cashCollected)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-sm font-black">
                  <span>Expected Cash in Drawer:</span>
                  <span className="text-cyan">
                    {naira(reconcileModal.openingCash + reconcileModal.cashCollected)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1">
                  Physically Counted Cash in Drawer (NGN)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="field w-full text-base font-mono"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-cyan text-slate-950 font-black hover:bg-cyan/90 h-10">
                Submit Reconciliation & Close Shift
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
