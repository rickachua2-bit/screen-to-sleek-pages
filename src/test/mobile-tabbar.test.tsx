import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home, LayoutGrid, Send } from "lucide-react";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), moduleChange: vi.fn(), action: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...p }: { children?: React.ReactNode } & Record<string, unknown>) => <a {...p}>{children}</a>,
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { name: "Ada Lovelace", initials: "AL" }, profile: { company_name: "Adaeze Kitchen" }, txns: [], ready: true, token: "tok", signOut: vi.fn(), setRole: vi.fn() }),
}));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: {}, receipts: [] }, error: "", refresh: vi.fn() }) }));
vi.mock("@/lib/live-updates", () => ({ captureInbound: vi.fn(), useLiveUpdates: vi.fn() }));
vi.mock("@/lib/currency-store", () => ({ setCurrency: vi.fn(), useCurrency: () => "NGN" }));
vi.mock("@/lib/kyb.functions", () => ({ switchAccountMode: vi.fn() }));
vi.mock("@/components/slikpay/CurrencyWallet", () => ({ CurrencyBar: () => null, CurrencyWallet: () => null, PortfolioHeader: () => null }));
import { AppShell } from "@/components/slikpay/AppShell";

const NAV = [
  { label: "Home", icon: Home, id: "overview" },
  { label: "Payments", icon: Send, id: "links" },
  { label: "More", icon: LayoutGrid, id: "more" },
];

describe("mobile bottom tab bar", () => {
  it("renders tabs with a raised center action and navigates on tap", () => {
    render(
      <AppShell mode="merchant" nav={NAV} activeModule="overview" onModuleChange={mocks.moduleChange} bottomNav={NAV} bottomAction={{ label: "New payment or transfer", onClick: mocks.action }}>
        <p>content</p>
      </AppShell>,
    );
    const bar = screen.getByRole("navigation", { name: "Quick navigation" });
    expect(bar.className).toContain("lg:hidden");
    expect(bar.className).toContain("rounded-3xl");
    expect(screen.getByRole("button", { name: "New payment or transfer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Payments" }));
    expect(mocks.moduleChange).toHaveBeenCalledWith("links");
    fireEvent.click(screen.getByRole("button", { name: "New payment or transfer" }));
    expect(mocks.action).toHaveBeenCalled();
  });

  it("marks the active tab and opens the drawer from More", () => {
    render(
      <AppShell mode="merchant" nav={NAV} activeModule="links" onModuleChange={mocks.moduleChange} bottomNav={NAV}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole("button", { name: "Payments" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open full menu" }));
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toBeTruthy();
  });
});
