import { useState } from "react";
import { 
  BadgeCheck, Check, Clock, DollarSign, KeyRound, 
  Lock, Plus, RefreshCw, ShieldAlert, ShieldCheck, 
  Smartphone, UserCheck, Users, X 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/api";

interface Cashier {
  id: string;
  name: string;
  phone: string;
  role: "Lead Cashier" | "Cashier Associate";
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

const INITIAL_CASHIERS: Cashier[] = [
  {
    id: "CSH-01",
    name: "Blessing Okon",
    phone: "08031234567",
    role: "Lead Cashier",
    terminal: "Front Counter · POS 1",
    status: "active",
    lastShift: "Today, 08:30 AM",
    pinSet: true,
  },
  {
    id: "CSH-02",
    name: "Tunde Adeyemi",
    phone: "08149876543",
    role: "Cashier Associate",
    terminal: "Drive-Thru / Standee 2",
    status: "active",
    lastShift: "Today, 09:00 AM",
    pinSet: true,
  },
  {
    id: "CSH-03",
    name: "Amina Bello",
    phone: "07065551234",
    role: "Cashier Associate",
    terminal: "Branch VIP Lounge",
    status: "inactive",
    lastShift: "Yesterday, 06:00 PM",
    pinSet: true,
  },
];

const INITIAL_SHIFTS: ActiveShift[] = [
  {
    id: "SFT-902",
    cashierName: "Blessing Okon",
    terminal: "Front Counter · POS 1",
    startedAt: "08:30 AM (4h 15m ago)",
    openingCash: 20000,
    cashCollected: 85400,
    tapSmartTagVolume: 345000,
    cardVolume: 180000,
    totalCollected: 610400,
  },
  {
    id: "SFT-903",
    cashierName: "Tunde Adeyemi",
    terminal: "Drive-Thru / Standee 2",
    startedAt: "09:00 AM (3h 45m ago)",
    openingCash: 15000,
    cashCollected: 42000,
    tapSmartTagVolume: 210000,
    cardVolume: 95000,
    totalCollected: 347000,
  },
];

export function CashierShiftsManager() {
  const [cashiers, setCashiers] = useState<Cashier[]>(INITIAL_CASHIERS);
  const [shifts, setShifts] = useState<ActiveShift[]>(INITIAL_SHIFTS);
  const [tab, setTab] = useState<"shifts" | "staff">("shifts");
  const [addModal, setAddModal] = useState(false);
  const [reconcileModal, setReconcileModal] = useState<ActiveShift | null>(null);

  // New Cashier Form State
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTerminal, setNewTerminal] = useState("Main Register POS");
  const [newPin, setNewPin] = useState("");

  // Reconcile Form State
  const [countedCash, setCountedCash] = useState("");

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
      description: `4-digit PIN encrypted and activated on terminal ${created.terminal}.`,
    });
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileModal) return;

    const actualCash = parseFloat(countedCash) || 0;
    const expectedCash = reconcileModal.openingCash + reconcileModal.cashCollected;
    const variance = actualCash - expectedCash;

    setShifts(shifts.filter((s) => s.id !== reconcileModal.id));
    setReconcileModal(null);
    setCountedCash("");

    if (Math.abs(variance) < 1) {
      toast.success("Shift closed · Perfect Till Balance", {
        description: `Total revenue of ${naira(reconcileModal.totalCollected)} reconciled with ₦0 variance.`,
      });
    } else if (variance < 0) {
      toast.warning("Shift closed with cash deficit", {
        description: `Shortage of ${naira(Math.abs(variance))} recorded in loss-prevention audit.`,
      });
    } else {
      toast.info("Shift closed with cash overage", {
        description: `Surplus of ${naira(variance)} recorded in audit log.`,
      });
    }
  };

  return (
    <section className="space-y-6">
      {/* Metric Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Active Cashier Shifts</span>
          <p className="mt-1 text-2xl font-black text-cyan">{shifts.length} Online</p>
          <span className="mt-1 flex items-center gap-1 text-[11px] text-success">
            <Check className="h-3 w-3" /> Live till monitoring active
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Today's Shift Sales</span>
          <p className="mt-1 text-2xl font-black text-foreground">{naira(shifts.reduce((a, b) => a + b.totalCollected, 0))}</p>
          <span className="mt-1 text-[11px] text-muted-foreground">NFC Tap & Card volume</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Registered Cashiers</span>
          <p className="mt-1 text-2xl font-black text-foreground">{cashiers.length} Staff</p>
          <span className="mt-1 text-[11px] text-muted-foreground">Individual 4-digit PINs</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-xs font-semibold text-muted-foreground">Loss Prevention</span>
          <p className="mt-1 text-2xl font-black text-success">100% Zero Drift</p>
          <span className="mt-1 text-[11px] text-muted-foreground">Dual-signature end of shift</span>
        </div>
      </div>

      {/* Tabs & Add Cashier Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-2">
        <div className="flex gap-2">
          <Button
            variant={tab === "shifts" ? "brand" : "ghost"}
            size="sm"
            onClick={() => setTab("shifts")}
            className="rounded-full"
          >
            <Clock className="h-4 w-4" /> Live Shifts ({shifts.length})
          </Button>
          <Button
            variant={tab === "staff" ? "brand" : "ghost"}
            size="sm"
            onClick={() => setTab("staff")}
            className="rounded-full"
          >
            <Users className="h-4 w-4" /> Cashier Directory ({cashiers.length})
          </Button>
        </div>

        <Button
          size="sm"
          variant="brand"
          onClick={() => setAddModal(true)}
          className="shine bg-gradient-tri font-bold text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Register Cashier
        </Button>
      </div>

      {/* Tab 1: Live Shifts View */}
      {tab === "shifts" && (
        <div className="grid gap-4 md:grid-cols-2">
          {shifts.map((s) => (
            <div key={s.id} className="rounded-3xl border border-border bg-card p-5 shadow-lg space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-foreground">{s.cashierName}</h3>
                  <p className="text-xs text-muted-foreground">{s.terminal}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-[10px] font-bold text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Active Shift
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border p-2.5">
                  <span className="text-muted-foreground block text-[10px]">Opening Till (Cash)</span>
                  <span className="font-bold text-foreground">{naira(s.openingCash)}</span>
                </div>
                <div className="rounded-xl border border-border p-2.5">
                  <span className="text-muted-foreground block text-[10px]">Cash Received</span>
                  <span className="font-bold text-foreground">{naira(s.cashCollected)}</span>
                </div>
                <div className="rounded-xl border border-border p-2.5">
                  <span className="text-muted-foreground block text-[10px]">SmartTag Tap / SoftPOS</span>
                  <span className="font-bold text-cyan">{naira(s.tapSmartTagVolume)}</span>
                </div>
                <div className="rounded-xl border border-border p-2.5">
                  <span className="text-muted-foreground block text-[10px]">Total Till Revenue</span>
                  <span className="font-black text-foreground">{naira(s.totalCollected)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground font-semibold">Started {s.startedAt}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReconcileModal(s)}
                  className="font-bold text-xs"
                >
                  Close & Reconcile Shift
                </Button>
              </div>
            </div>
          ))}

          {!shifts.length && (
            <div className="col-span-2 py-16 text-center text-muted-foreground">
              <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="font-bold text-foreground">No active cashier shifts</p>
              <p className="text-xs">Cashiers can open a shift directly on their assigned POS or SmartTag terminal.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Cashier Directory View */}
      {tab === "staff" && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground">
              <tr>
                <th className="p-4">Cashier Name</th>
                <th className="p-4">Assigned Register</th>
                <th className="p-4">Role</th>
                <th className="p-4">POS Security PIN</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {cashiers.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/20">
                  <td className="p-4">
                    <span className="font-bold text-foreground block">{c.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.phone}</span>
                  </td>
                  <td className="p-4 text-xs font-semibold text-foreground">{c.terminal}</td>
                  <td className="p-4">
                    <span className="rounded-full border border-cobalt/20 bg-cobalt/5 px-2.5 py-0.5 text-xs font-bold text-cobalt">
                      {c.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-success">
                      <KeyRound className="h-3.5 w-3.5" /> 4-Digit PIN Active
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.info(`PIN reset code sent to ${c.name}'s phone`)}
                      className="text-xs"
                    >
                      Reset PIN
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Cashier Modal */}
      {addModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 slik-overlay-backdrop backdrop-blur-sm"
          onClick={() => setAddModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-extrabold text-foreground">Register Cashier Staff</h2>
                <span className="text-xs text-muted-foreground">Provision terminal login credentials</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAddModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleAddCashier} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground">Cashier Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Adekunle"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="field mt-1 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="080 1234 5678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="field mt-1 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">Assigned Register / Standee</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Counter Register 2"
                  value={newTerminal}
                  onChange={(e) => setNewTerminal(e.target.value)}
                  className="field mt-1 w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground">4-Digit Terminal PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  className="field mt-1 w-full text-center font-mono text-base tracking-[0.5em]"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">Used by cashier to unlock POS terminal & start till shifts.</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 shine bg-gradient-tri font-bold">
                  Activate Cashier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Shift Reconcile Modal */}
      {reconcileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 slik-overlay-backdrop backdrop-blur-sm"
          onClick={() => setReconcileModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-extrabold text-foreground">Reconcile & Close Till Shift</h2>
                <span className="text-xs text-muted-foreground">{reconcileModal.cashierName} · {reconcileModal.terminal}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReconcileModal(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening Cash Till:</span>
                <span className="font-bold text-foreground">{naira(reconcileModal.openingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash Sales Recorded:</span>
                <span className="font-bold text-foreground">{naira(reconcileModal.cashCollected)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-bold">
                <span className="text-foreground">Expected Physical Cash:</span>
                <span className="text-foreground">{naira(reconcileModal.openingCash + reconcileModal.cashCollected)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground">Actual Counted Cash in Till (₦)</label>
                <input
                  type="number"
                  required
                  placeholder="Enter physical cash counted in drawer..."
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="field mt-1 w-full text-sm font-extrabold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setReconcileModal(null)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 shine bg-gradient-tri font-bold">
                  Confirm & Sign Off Shift
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
