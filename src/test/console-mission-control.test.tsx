import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), manage: vi.fn(), send: vi.fn(), webhooks: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/business-keys.functions", () => ({ listBusinessKeys: mocks.load, manageBusinessKey: mocks.manage, startKeyEmailCode: mocks.send }));
vi.mock("@/lib/developer.functions", () => ({ getWebhookEvents: mocks.webhooks }));
import { ConsoleMissionControl } from "@/components/slikpay/ConsoleMissionControl";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("opens webhook monitoring without dispatching a payment or key action", async () => {
  mocks.load.mockResolvedValue([]);
  mocks.webhooks.mockResolvedValue({ configured: true, mode: "sandbox", events: [] });
  const open = vi.fn();
  render(<ConsoleMissionControl profile={null} onWebhooks={open} />);
  await waitFor(() => expect(mocks.webhooks).toHaveBeenCalledWith({ data: { status: "all" } }));
  fireEvent.click(screen.getByRole("button", { name: /view all events/i }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(mocks.manage).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});

it("keeps live-key claiming behind the existing email-code challenge", async () => {
  mocks.load.mockResolvedValue([{ id: "a-key-id", mode: "live", revoked_at: null, claimed_at: null, expires_at: "2099-01-01", last_used_at: null }]);
  mocks.webhooks.mockResolvedValue({ configured: true, mode: "live", events: [] });
  render(<ConsoleMissionControl profile={null} onWebhooks={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: /claim once/i }));
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  expect(mocks.manage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /email me a code/i }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
  expect(mocks.manage).not.toHaveBeenCalled();
});