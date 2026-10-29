import Papa from "papaparse";
import { slikpayTransferFee, validTransferAmount } from "./transfer-validation";
export type Recipient = { bankCode: string; bankName: string; account: string; name: string; amount?: number; at?: number };

/** Same account + same amount within 10 minutes counts as a likely duplicate. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
export function isDuplicate(history: Recipient[], next: { account: string; amount: number }, now = Date.now()): boolean {
  return history.some((h) => h.account === next.account && h.amount === next.amount && h.at !== undefined && now - h.at < DUPLICATE_WINDOW_MS);
}

/** Keep newest first, one entry per account, at most 8. */
export function rememberRecipient(list: Recipient[], r: Recipient): Recipient[] {
  return [r, ...list.filter((x) => x.account !== r.account)].slice(0, 8);
}

export type BulkRow = { bankCode: string; account: string; amount: number; note?: string | undefined; error?: string | undefined };
/** CSV columns: bank_code, account_number, amount, note(optional). Header row optional. */
export function parseBulkCsv(text: string): BulkRow[] {
  if (text.length > 1_000_000) throw new Error("Upload a CSV smaller than 1 MB.");
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error("The CSV has invalid quoted cells. Correct the file and upload again.");
  const data = parsed.data;
  if (data[0]?.[1]?.trim().toLowerCase() === "account_number") data.shift();
  if (data.length > 500) throw new Error("Upload up to 500 payments per batch.");
  const seen = new Set<string>();
  return data.map((cells) => {
      const [bankCode = "", account = "", amt = "", note] = cells.map((c) => c.trim());
      const amount = Number(amt);
      const key = `${bankCode}:${account}:${amount}`;
      const error = cells.length < 3 || cells.length > 4 ? "Use 3 or 4 columns" : !/^\d{3,6}$/.test(bankCode) ? "Bad bank code" : !/^\d{10}$/.test(account) ? "Account must be 10 digits" : !validTransferAmount(amt) ? "Bad amount" : (note?.length ?? 0) > 160 ? "Note exceeds 160 characters" : seen.has(key) ? "Duplicate payment in this file" : undefined;
      seen.add(key);
      return { bankCode, account, amount, note: note || undefined, error };
    });
}
export function bulkTotals(rows: Pick<BulkRow, "amount">[]) {
  const principal = Math.round(rows.reduce((n, r) => n + r.amount, 0) * 100) / 100;
  const fees = Math.round(rows.reduce((n, r) => n + slikpayTransferFee(r.amount), 0) * 100) / 100;
  return { principal, fees, total: Math.round((principal + fees) * 100) / 100 };
}
export function insufficientBulkBalance(live: boolean, total: number, balance: number | undefined) {
  return live && (balance === undefined || !Number.isFinite(balance) || total > balance);
}
