import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshBankingProfile, resetBankingProfileForTests, useBankingProfile } from "@/components/slikpay/PaddleConsole";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/paddle.functions", () => ({ getBankingProfile: mocks.load, runPaddleOperation: vi.fn(), submitIdentityCheck: vi.fn() }));
vi.mock("@/lib/developer.functions", () => ({ getWebhookEvents: vi.fn(), reconcileWebhook: vi.fn() }));
vi.mock("@/lib/business-keys.functions", () => ({ listBusinessKeys: vi.fn(), manageBusinessKey: vi.fn() }));

const profile = { mode: "sandbox", balances: { NGN: 125000 } } as never;

beforeEach(() => {
  resetBankingProfileForTests();
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(profile);
});

describe("dashboard refresh", () => {
  it("one refresh updates every dashboard view with a single fetch", async () => {
    const a = renderHook(() => useBankingProfile());
    await waitFor(() => expect(a.result.current.profile).toEqual(profile));
    const b = renderHook(() => useBankingProfile());
    await waitFor(() => expect(b.result.current.profile).toEqual(profile));
    const fetches = mocks.load.mock.calls.length;
    await Promise.all([a.result.current.refresh(), b.result.current.refresh()]);
    expect(mocks.load.mock.calls.length).toBe(fetches + 1); // concurrent taps share one fetch
    expect(a.result.current.profile).toEqual(profile);
    expect(a.result.current.updatedAt).toBeInstanceOf(Date);
    await waitFor(() => expect(b.result.current.updatedAt).toEqual(a.result.current.updatedAt));
  });

  it("exposes the loader to explicit refreshes without a mounted view", async () => {
    const loader = vi.fn().mockResolvedValue(profile);
    await refreshBankingProfile(loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
