import Papa from "papaparse";

export type ImportColumns = { bank: string; account: string; amount: string; note: string };
export function readBulkImport(text: string) {
  if (text.length > 1_000_000) throw new Error("Upload a CSV smaller than 1 MB.");
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  if (result.errors.length) throw new Error("The CSV has invalid quoted cells. Correct the file and upload again.");
  const first = result.data[0];
  if (!first) throw new Error("This file contains no payments.");
  const hasHeader = first.some((v) => /bank|account|amount|note|narration/i.test(v));
  const headers = hasHeader ? first : first.map((_, i) => `Column ${i + 1}`);
  const rows = hasHeader ? result.data.slice(1) : result.data;
  if (!rows.length) throw new Error("This file contains no payments.");
  if (rows.length > 500) throw new Error("Upload up to 500 payments per batch.");
  const locate = (pattern: RegExp, fallback: number) => {
    const index = hasHeader ? headers.findIndex((v) => pattern.test(v)) : fallback;
    return index < 0 || index >= headers.length ? "" : String(index);
  };
  return { headers, rows, columns: { bank: locate(/bank.*code/i, 0), account: locate(/account.*(number|no)/i, 1), amount: locate(/amount/i, 2), note: locate(/note|narration/i, 3) } };
}
export function mappedBulkCsv(rows: string[][], columns: ImportColumns) {
  if (!columns.bank || !columns.account || !columns.amount) throw new Error("Choose bank code, account number and amount columns.");
  if (new Set([columns.bank, columns.account, columns.amount, ...(columns.note ? [columns.note] : [])]).size !== (columns.note ? 4 : 3)) throw new Error("Choose a different column for each field.");
  return Papa.unparse({ fields: ["bank_code", "account_number", "amount", "note"], data: rows.map((r) => [r[Number(columns.bank)] ?? "", r[Number(columns.account)] ?? "", r[Number(columns.amount)] ?? "", columns.note ? r[Number(columns.note)] ?? "" : ""]) });
}