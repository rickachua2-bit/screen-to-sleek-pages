import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BulkImport } from "@/components/slikpay/BulkImport";
import { parseBulkCsv } from "@/lib/transfer-rules";

describe("payment file review flow", () => {
  it("submits corrected real file values for server verification only", async () => {
    const prepare = vi.fn().mockResolvedValue(undefined);
    const screen = render(<BulkImport busy={false} onPrepare={prepare} />);
    const csv = "amount,account_number,bank_code,note\n100,123,058,Salary";
    const file = new File([csv], "salary.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => csv });
    fireEvent.change(screen.getByLabelText("Upload payment CSV"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText("Row 1 account")).toBeDefined());
    fireEvent.change(screen.getByLabelText("Row 1 account"), { target: { value: "0123456789" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify recipients/ }));
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
    expect(parseBulkCsv(prepare.mock.calls[0]?.[0] ?? "")[0]).toMatchObject({ bankCode: "058", account: "0123456789", amount: 100, note: "Salary", error: undefined });
  });
});