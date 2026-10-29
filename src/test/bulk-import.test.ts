import { describe, expect, it } from "vitest";
import { mappedBulkCsv, readBulkImport } from "@/lib/bulk-import";
import { parseBulkCsv } from "@/lib/transfer-rules";
describe("bulk import preserves payment values", () => {
  it("maps reordered columns without losing account leading zeros", () => {
    const data = readBulkImport('amount,account_number,bank_code,note\n100,0123456789,058,"Salary, October"');
    expect(parseBulkCsv(mappedBulkCsv(data.rows, data.columns))[0]).toMatchObject({ bankCode: "058", account: "0123456789", amount: 100, note: "Salary, October", error: undefined });
  });
  it("rejects reuse of a column across payment fields", () => {
    expect(() => mappedBulkCsv([["058", "0123456789", "100"]], { bank: "0", account: "1", amount: "1", note: "" })).toThrow();
  });
  it("keeps duplicates blocked after mapping", () => {
    const data = readBulkImport("058,0123456789,100\n058,0123456789,100");
    expect(parseBulkCsv(mappedBulkCsv(data.rows, data.columns))[1]?.error).toBeDefined();
  });
  it("keeps the existing 500-row limit", () => {
    expect(() => readBulkImport(Array.from({ length: 501 }, () => "058,0123456789,100").join("\n"))).toThrow();
  });
});