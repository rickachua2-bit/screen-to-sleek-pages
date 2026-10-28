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
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .filter((l, i) => !(i === 0 && /[a-z]/i.test(l.split(",")[1] ?? "")))
    .map((l) => {
      const [bankCode = "", account = "", amt = "", note] = l.split(",").map((c) => c.trim());
      const amount = Number(amt);
      const error = !/^\d{3,6}$/.test(bankCode) ? "Bad bank code" : !/^\d{10}$/.test(account) ? "Account must be 10 digits" : !(amount > 0) ? "Bad amount" : undefined;
      return { bankCode, account, amount, note: note || undefined, error };
    });
}
