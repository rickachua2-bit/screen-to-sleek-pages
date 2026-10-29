import { slikpayTransferFee } from "./transfer-validation";
import { SWAP_NOT_READY } from "./wallet-safety";

export type CryptoBankStage = "ready" | "converting" | "conversion_pending" | "converted" | "paying" | "payout_pending" | "completed";
export interface CryptoBankState {
  stage: CryptoBankStage;
  credited: number;
  payoutAmount: number;
  swapId: string;
  payoutId: string;
  message: string;
}
type SwapInput = { from: "USDT" | "USDC"; to: "NGN"; amount: number; pin: string; idempotencyKey: string };
export interface CryptoBankRecipient { bankCode: string; accountNumber: string; accountName: string }
type WithdrawalInput = { currency: "NGN"; amount: number; pin: string; idempotencyKey: string; recipient?: CryptoBankRecipient };

/** A single mounted review session. Durable recovery remains the server ledger's responsibility. */
export function createCryptoBankFlow(deps: {
  swap: (input: SwapInput) => Promise<{ credited: number }>;
  withdraw: (input: WithdrawalInput) => Promise<unknown>;
  id: () => string;
  changed: (state: CryptoBankState) => void;
  resume?: { coin: "USDT" | "USDC"; amount: number; swapId: string };
}) {
  let original = deps.resume;
  let state: CryptoBankState = { stage: original ? "conversion_pending" : "ready", credited: 0, payoutAmount: 0, swapId: original?.swapId ?? deps.id(), payoutId: deps.id(), message: "" };
  const update = (patch: Partial<CryptoBankState>) => { state = { ...state, ...patch }; deps.changed(state); };
  return {
    async convert(coin: "USDT" | "USDC", amount: number, pin: string) {
      if (state.stage !== "ready" && state.stage !== "conversion_pending") return;
      if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}$/.test(pin)) throw new Error("Enter a valid amount and 4-digit transaction PIN.");
      if (state.stage === "conversion_pending" && original) { coin = original.coin; amount = original.amount; }
      original = { coin, amount, swapId: state.swapId };
      update({ stage: "converting", message: "Confirming conversion…" });
      try {
        const result = await deps.swap({ from: coin, to: "NGN", amount, pin, idempotencyKey: state.swapId });
        if (!Number.isFinite(result.credited) || result.credited <= 0) throw new Error("Conversion confirmation is unavailable.");
        // Reserve room for the bank fee instead of attempting to withdraw all credited funds plus fees.
        let kobo = Math.floor(result.credited * 100);
        while (kobo > 0 && kobo / 100 + slikpayTransferFee(kobo / 100) > result.credited) kobo--;
        update({ stage: "converted", credited: result.credited, payoutAmount: kobo / 100, message: "Conversion complete. Review your bank withdrawal." });
      } catch (error) {
        const blocked = error instanceof Error && error.message === SWAP_NOT_READY;
        update({ stage: blocked ? "ready" : "conversion_pending", message: blocked ? SWAP_NOT_READY : "Conversion is awaiting confirmation. Check your ledger before sending again; no bank payout was submitted." });
      }
    },
    async pay(pin: string, recipient?: CryptoBankRecipient) {
      if (state.stage !== "converted" || state.payoutAmount <= 0) return;
      if (!/^\d{4}$/.test(pin)) throw new Error("Enter your 4-digit transaction PIN.");
      update({ stage: "paying", message: "Submitting bank withdrawal…" });
      try {
        await deps.withdraw({ currency: "NGN", amount: state.payoutAmount, pin, idempotencyKey: state.payoutId, ...(recipient ? { recipient } : {}) });
        update({ stage: "completed", message: "Bank withdrawal completed." });
      } catch {
        update({ stage: "payout_pending", message: "Bank withdrawal was not confirmed. Check your ledger for its status; any reserved funds remain unavailable. Do not submit again." });
      }
    },
  };
}