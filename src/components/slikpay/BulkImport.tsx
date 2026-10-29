import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readBulkImport, mappedBulkCsv, type ImportColumns } from "@/lib/bulk-import";
import { parseBulkCsv } from "@/lib/transfer-rules";
import documents from "@/assets/bulk-import-documents.png";

export function BulkImport({ busy, onPrepare, onStageChange }: { busy: boolean; onPrepare: (csv: string) => Promise<void>; onStageChange?: (selected: boolean) => void }) {
  const [file, setFile] = useState<ReturnType<typeof readBulkImport> | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => { onStageChange?.(file !== null); }, [file, onStageChange]);
  const preview = useMemo(() => {
    if (!file) return null;
    try { const csv = mappedBulkCsv(file.rows, file.columns); return { csv, rows: parseBulkCsv(csv), error: "" }; }
    catch (e) { return { csv: "", rows: [], error: e instanceof Error ? e.message : "Check column selection." }; }
  }, [file]);
  async function choose(selected: File) {
    setError("");
    try {
      if (selected.size > 1_000_000) throw new Error("Upload a CSV smaller than 1 MB.");
      setFile(readBulkImport(await selected.text())); setName(selected.name); setPage(0);
    } catch (e) { setFile(null); setError(e instanceof Error ? e.message : "Could not read the file."); }
  }
  const invalid = preview?.rows.filter((r) => r.error).length ?? 0;
  if (!file) return <div className="space-y-3">
    <label className={`bulk-studio-drop flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 p-5 text-center transition-colors hover:border-primary ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <img src={documents} width={992} height={672} alt="Payment documents and spreadsheet" className="bulk-studio-art" />
      <span className="font-bold text-foreground">Choose payment CSV</span><span className="text-xs text-muted-foreground">Up to 500 payments · 1 MB · NGN</span>
      <input type="file" aria-label="Upload payment CSV" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => { const selected = e.target.files?.[0]; if (selected) void choose(selected); e.target.value = ""; }} />
    </label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
  return <div className="space-y-4 bulk-studio-import">
    <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-foreground">{name}</p><p className="text-xs text-muted-foreground">{file.rows.length} payments · Import review</p></div><Button variant="ghost" size="icon" title="Discard import" aria-label="Discard import" disabled={busy} onClick={() => setFile(null)}><X /></Button></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([["bank", "Bank code"], ["account", "Account number"], ["amount", "Amount"], ["note", "Note · optional"]] as const).map(([key, label]) => <label className="text-xs font-semibold text-foreground" key={key}>{label}<select aria-label={`Map ${label}`} className="field mt-1 w-full" disabled={busy} value={file.columns[key]} onChange={(e) => { const columns: ImportColumns = { ...file.columns, [key]: e.target.value }; setFile({ ...file, columns }); }}><option value="">{key === "note" ? "None" : "Choose column"}</option>{file.headers.map((h, i) => <option key={i} value={String(i)}>{h}</option>)}</select></label>)}</div>
    {preview?.error ? <p role="alert" className="text-sm text-destructive">{preview.error}</p> : <>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[580px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr>{["Row", "Bank code", "Account number", "Amount", "Check"].map((h) => <th key={h} className="p-2.5">{h}</th>)}</tr></thead><tbody>{preview?.rows.slice(page * 10, page * 10 + 10).map((r, offset) => { const index = page * 10 + offset; return <tr key={index} className="border-t border-border"><td className="p-2">{index + 1}</td>{(["bank", "account", "amount"] as const).map((key) => <td className="p-2" key={key}><input aria-label={`Row ${index + 1} ${key}`} disabled={busy} className="field h-9 w-full min-w-24 font-mono text-xs" value={file.rows[index]?.[Number(file.columns[key])] ?? ""} onChange={(e) => { const rows = file.rows.map((cells, i) => i === index ? cells.map((value, column) => column === Number(file.columns[key]) ? e.target.value : value) : cells); setFile({ ...file, rows }); }} /></td>)}<td className={`max-w-40 p-2 ${r.error ? "text-destructive" : "text-success"}`}>{r.error || "Ready to verify"}</td></tr>; })}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className={invalid ? "text-destructive" : "text-muted-foreground"}>{invalid ? `${invalid} rows need correction` : "File checks passed"}</span><div className="flex items-center gap-2"><Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>{page + 1} / {Math.max(1, Math.ceil(file.rows.length / 10))}</span><Button variant="ghost" size="sm" disabled={(page + 1) * 10 >= file.rows.length} onClick={() => setPage(page + 1)}>Next</Button></div></div>
      <Button variant="brand" disabled={busy || invalid > 0 || !preview?.csv} onClick={async () => { if (!preview?.csv) return; await onPrepare(preview.csv); }} className="w-full sm:w-auto">{busy ? <Loader2 className="animate-spin" /> : <Upload />}Verify recipients<ArrowRight /></Button>
    </>}
  </div>;
}