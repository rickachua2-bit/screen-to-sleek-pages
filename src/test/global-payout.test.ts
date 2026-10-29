import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), call: vi.fn(), guard: vi.fn(), settle: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }), handler: (fn: unknown) => fn }) }));
vi.mock("@/lib/paddle.server", () => ({ bankingUser: mocks.user, callPaddle: mocks.call }));
vi.mock("@/lib/wallets.server", () => ({ guardMoney: mocks.guard, settleMoney: mocks.settle, readRecord: vi.fn(), holderName: vi.fn() }));
import { beneficiaryFor, corridorFor, globalWalletFee, minimumTargetAmount, nairaCrossBorderFee, safeDeclineReason } from "@/lib/international";
import { payoutStatus } from "@/lib/transfer-validation";
import { parseFxRates } from "@/lib/pricing";

/** Live provider rate sample: naira you get selling 1 unit, and naira to buy 1 unit. */
const fx = parseFxRates({ USD_NGN: 1720, NGN_USD_PRICE: 1725, GBP_NGN: 2170, NGN_GBP_PRICE: 2180 });

describe("owner-confirmed cross-border fee rules", () => {
  it("charges 0.5% with a 5-unit floor and a 25-unit cap on foreign-wallet payouts", () => {
    expect(globalWalletFee(100)).toBe(5);       // USD 100 → fee 5, total 105
    expect(globalWalletFee(2000)).toBe(10);     // USD 2,000 → fee 10, total 2,010
    expect(globalWalletFee(10000)).toBe(25);    // cap at 25 units
    expect(globalWalletFee(30)).toBe(5);        // floor at 5 units
  });
  it("charges 0.5% of the naira principal with a ₦5,000 floor on naira-funded payouts", () => {
    expect(nairaCrossBorderFee(172500)).toBe(5000);   // USD 100 at ₦1,725 → fee 5,000, total 177,500
    expect(nairaCrossBorderFee(400000)).toBe(5000);   // 0.5% = 2,000 → floor 5,000
    expect(nairaCrossBorderFee(2000000)).toBe(10000); // 0.5% = 10,000 above the floor
  });
  it("enforces the USD 10-equivalent minimum from live rates", () => {
    expect(minimumTargetAmount("NGN", "USD", fx)).toBe(10);
    expect(minimumTargetAmount("USD", "USD", fx)).toBe(10);
    expect(minimumTargetAmount("NGN", "GBP", fx)).toBeCloseTo(10 * 1720 / 2180, 2); // naira buys GBP at ask
    expect(minimumTargetAmount("GBP", "GBP", fx)).toBeCloseTo(10 * 1720 / 2170, 2); // held GBP valued at bid
  });
});

describe("corridor beneficiary validation", () => {
  const fill = (country: string, values: Record<string, string>) => {
    const corridor = corridorFor(country);
    if (!corridor) throw new Error("missing corridor");
    return beneficiaryFor(corridor, "Ada Obi", values);
  };
  it("accepts the confirmed US corridor fields", () => {
    expect(fill("US", { bankName: "First Bank", routingNumber: "021000021", accountNumber: "123456789" }))
      .toMatchObject({ accountName: "Ada Obi", country: "US", routingNumber: "021000021" });
  });
  it("rejects a US routing number that is not 9 digits", () => {
    expect(() => fill("US", { bankName: "First Bank", routingNumber: "02100", accountNumber: "123456789" })).toThrow(/routing number/i);
  });
  it("requires a 6-digit sort code and 8-digit account for the UK", () => {
    expect(() => fill("GB", { sortCode: "04-00-04", accountNumber: "12345678" })).toThrow();
    expect(fill("GB", { sortCode: "040004", accountNumber: "12345678" }).sortCode).toBe("040004");
  });
  it("requires IBAN and BIC for euro corridors", () => {
    const de = corridorFor("DE");
    if (!de) throw new Error("missing corridor");
    expect(() => beneficiaryFor(de, "Ada Obi", { iban: "DE89370400440532013000" })).toThrow(/bic/i);
    expect(beneficiaryFor(de, "Ada Obi", { iban: "DE89370400440532013000", bic: "COBADEFFXXX" }).country).toBe("DE");
  });
  it("rejects unknown destinations", () => {
    expect(corridorFor("NG")).toBeNull();
  });
});

describe("owner-confirmed status handling", () => {
  it("maps only terminal decline statuses to failed, case-insensitively", () => {
    for (const s of ["FAILED", "Declined", "REJECTED", "reversed"]) expect(payoutStatus({ status: s })).toBe("failed");
    for (const s of ["SUCCESSFUL", "Completed", "success"]) expect(payoutStatus({ status: s })).toBe("succeeded");
    for (const s of ["PENDING", "processing", ""]) expect(payoutStatus({ status: s })).toBe("pending");
  });
  it("scrubs provider names out of the clearing network's failure reason", () => {
    expect(safeDeclineReason("Beneficiary account closed or routing number invalid")).toBe("Beneficiary account closed or routing number invalid");
    expect(safeDeclineReason("Paddle Baas Sterling rejected the beneficiary")).toBe("rejected the beneficiary");
    expect(safeDeclineReason(undefined)).toBe("Declined by the clearing network");
  });
});

describe("global payout execution contract", () => {
  const ctx = { db: { from: () => { throw new Error("unexpected ledger read"); } }, user: { id: "owner" }, mode: "live", review: "approved" };
  const base = { sourceCurrency: "NGN", country: "US", accountName: "Ada Obi", beneficiary: { bankName: "First Bank", routingNumber: "021000021", accountNumber: "123456789" } };
  const rates = { data: { rates: { USD_NGN: 1720, NGN_USD_PRICE: 1725 } } };
  const load = async () => (await import("@/lib/global-payout.server"));

  it("quotes the owner's example: USD 100 at ₦1,725 debits ₦177,500", async () => {
    const { buildGlobalQuote } = await load();
    mocks.call.mockResolvedValueOnce(rates);
    const { quote } = await buildGlobalQuote(ctx as never, { ...base, amount: 100 });
    expect(quote.principal).toBe(172500);
    expect(quote.fee).toBe(5000);
    expect(quote.totalDebit).toBe(177500);
    expect(quote.feeCurrency).toBe("NGN");
  });
  it("refuses naira-funded payments when rates are unavailable", async () => {
    const { buildGlobalQuote } = await load();
    mocks.call.mockResolvedValueOnce({ data: { rates: {} } });
    await expect(buildGlobalQuote(ctx as never, { ...base, amount: 100 })).rejects.toThrow(/unavailable/i);
    expect(mocks.guard).not.toHaveBeenCalled();
  });
  it("reserves the exact fee-inclusive total once before dispatch", async () => {
    const { executeGlobalPayout } = await load();
    mocks.call.mockResolvedValueOnce(rates);
    mocks.call.mockResolvedValueOnce({ data: { status: "SUCCESSFUL", reference: "GLB-1", trackingReference: "SWIFT-1", debitAmount: 177500, fee: 5000, feeCurrency: "NGN" } });
    const r = await executeGlobalPayout({ ...ctx, db: chainDb({ data: null, error: null }) } as never, { ...base, amount: 100, idempotencyKey: "k1", pin: "1234" });
    expect(r.status).toBe("succeeded");
    expect(mocks.guard).toHaveBeenCalledWith(expect.anything(), "NGN", 177500, "1234", "POST /v1/payouts/global", "k1");
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "k1", "succeeded", "GLB-1", expect.objectContaining({ fee: 5000, trackingReference: "SWIFT-1" }));
  });
  it("settles pending and retains funds on a network timeout", async () => {
    const { executeGlobalPayout } = await load();
    mocks.call.mockResolvedValueOnce(rates);
    mocks.call.mockRejectedValueOnce(Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }));
    await expect(executeGlobalPayout({ ...ctx, db: chainDb({ data: null, error: null }) } as never, { ...base, amount: 100, idempotencyKey: "k2" })).rejects.toThrow(/awaiting confirmation/i);
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "k2", "pending", null, expect.objectContaining({ note: expect.stringMatching(/awaiting international network confirmation/) }));
    expect(mocks.settle).not.toHaveBeenCalledWith(expect.anything(), "k2", "failed", expect.anything(), expect.anything());
  });
  it("releases funds only on a terminal decline, with the network's reason", async () => {
    const { executeGlobalPayout } = await load();
    mocks.call.mockResolvedValueOnce(rates);
    mocks.call.mockResolvedValueOnce({ data: { status: "DECLINED", failureReason: "Beneficiary account closed", debitAmount: 177500, fee: 5000, feeCurrency: "NGN" } });
    await expect(executeGlobalPayout({ ...ctx, db: chainDb({ data: null, error: null }) } as never, { ...base, amount: 100, idempotencyKey: "k3" })).rejects.toThrow(/declined/i);
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "k3", "failed", null, expect.objectContaining({ error: "Beneficiary account closed" }));
  });
  it("keeps funds pending when the network reports success with different debit totals", async () => {
    const { executeGlobalPayout } = await load();
    mocks.call.mockResolvedValueOnce(rates);
    mocks.call.mockResolvedValueOnce({ data: { status: "SUCCESSFUL", reference: "GLB-4", debitAmount: 179000, fee: 6500, feeCurrency: "NGN" } });
    await expect(executeGlobalPayout({ ...ctx, db: chainDb({ data: null, error: null }) } as never, { ...base, amount: 100, idempotencyKey: "k4" })).rejects.toThrow(/awaiting confirmation/i);
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "k4", "pending", "GLB-4", expect.objectContaining({ note: expect.stringMatching(/reconciliation/i) }));
  });
  it("never re-dispatches a pending payment; it re-checks status instead", async () => {
    const { executeGlobalPayout } = await load();
    const db = chainDb({ data: { operation: "POST /v1/payouts/global", currency: "NGN", amount: 177500, status: "pending", summary: { principal: 172500, fee: 5000 }, provider_reference: null }, error: null });
    mocks.call.mockResolvedValueOnce(rates); // fx for the quote
    mocks.call.mockResolvedValueOnce({ data: { status: "PENDING" } }); // status query only
    const r = await executeGlobalPayout({ ...ctx, db } as never, { ...base, amount: 100, idempotencyKey: "k5" });
    expect(r.status).toBe("pending");
    expect(mocks.call).toHaveBeenCalledTimes(2);
    expect(mocks.guard).not.toHaveBeenCalled();
  });
  it("rejects a reference that belongs to a different payment", async () => {
    const { executeGlobalPayout } = await load();
    const db = chainDb({ data: { operation: "SWAP USDT->NGN", currency: "NGN", amount: 177500, status: "pending", summary: {}, provider_reference: null }, error: null });
    mocks.call.mockResolvedValueOnce(rates);
    await expect(executeGlobalPayout({ ...ctx, db } as never, { ...base, amount: 100, idempotencyKey: "k6" })).rejects.toThrow(/different payment/i);
    expect(mocks.guard).not.toHaveBeenCalled();
  });
});

describe("recovery via the original payment key", () => {
  const ctx = { db: { from: () => { throw new Error("unexpected ledger read"); } }, user: { id: "owner" }, mode: "live", review: "approved" };
  const pending = { id: "r1", operation: "POST /v1/payouts/global", status: "pending", summary: { principal: 172500, fee: 5000, destinationCurrency: "USD" }, provider_reference: null };
  const load = async () => (await import("@/lib/global-payout.server"));

  it("settles success only when debit totals match the reservation", async () => {
    const { checkGlobalPayoutStatus } = await load();
    mocks.call.mockResolvedValueOnce({ data: { status: "SUCCESSFUL", reference: "GLB-7", trackingReference: "SWIFT-9", debitAmount: 177500, fee: 5000 } });
    const r = await checkGlobalPayoutStatus({ ...ctx, db: chainDb({ data: pending, error: null }) } as never, "k7");
    expect(r.status).toBe("succeeded");
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "k7", "succeeded", "GLB-7", expect.objectContaining({ trackingReference: "SWIFT-9" }));
  });
  it("releases funds on a terminal REVERSED status", async () => {
    const { checkGlobalPayoutStatus } = await load();
    mocks.call.mockResolvedValueOnce({ data: { status: "REVERSED", failureReason: "Returned by beneficiary bank", reference: "GLB-8" } });
    const r = await checkGlobalPayoutStatus({ ...ctx, db: chainDb({ data: pending, error: null }) } as never, "k8");
    expect(r.status).toBe("failed");
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "k8", "failed", "GLB-8", expect.objectContaining({ error: "Returned by beneficiary bank" }));
  });
  it("never releases funds on pending or unreachable status", async () => {
    const { checkGlobalPayoutStatus } = await load();
    mocks.call.mockResolvedValueOnce({ data: { status: "PENDING", reference: "GLB-9" } });
    await expect(checkGlobalPayoutStatus({ ...ctx, db: chainDb({ data: pending, error: null }) } as never, "k9")).resolves.toMatchObject({ status: "pending" });
    mocks.call.mockRejectedValueOnce(new Error("HTTP 404"));
    await expect(checkGlobalPayoutStatus({ ...ctx, db: chainDb({ data: pending, error: null }) } as never, "k10")).resolves.toMatchObject({ status: "pending" });
    expect(mocks.settle).not.toHaveBeenCalled();
  });
});

/** Minimal chainable ledger client mock: every builder method returns the chain, awaits resolve to the result. */
function chainDb(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "in", "order", "limit", "update", "upsert"]) c[m] = () => c;
  c["maybeSingle"] = async () => ({ data: result.data, error: result.error });
  c["then"] = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return c;
}
