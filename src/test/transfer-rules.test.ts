import { describe, expect, it } from "vitest";
import { isDuplicate, parseBulkCsv, rememberRecipient } from "@/lib/transfer-rules";

describe("transfer rules", () => {
  const now = 1_000_000_000;
  const h = [{ bankCode: "058", bankName: "B", account: "0123456789", name: "A", amount: 5000, at: now - 5 * 60_000 }];
  it("flags same account and amount within 10 minutes", () => expect(isDuplicate(h, { account: "0123456789", amount: 5000 }, now)).toBe(true));
  it("does not flag after 10 minutes", () => expect(isDuplicate(h, { account: "0123456789", amount: 5000 }, now + 6 * 60_000)).toBe(false));
  it("does not flag a different amount", () => expect(isDuplicate(h, { account: "0123456789", amount: 5001 }, now)).toBe(false));
  it("keeps one entry per account, max 8", () => {
    let l = h; for (let i = 0; i < 10; i++) l = rememberRecipient(l, { ...h[0], account: String(1000000000 + i) });
    expect(l).toHaveLength(8);
  });
  it("parses bulk CSV and flags bad rows", () => {
    const r = parseBulkCsv("bank_code,account_number,amount\n058,0123456789,2500,Salary\n058,123,10");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ amount: 2500, note: "Salary", error: undefined });
    expect(r[1].error).toBe("Account must be 10 digits");
  });
});
