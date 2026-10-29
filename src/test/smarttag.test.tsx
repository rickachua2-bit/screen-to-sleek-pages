import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), charge: vi.fn(), listBoxes: vi.fn(), registerBox: vi.fn(), updateBox: vi.fn(), unlinkBox: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn, createServerFn: () => ({ inputValidator: () => ({ handler: () => ({}) }), handler: () => ({}) }) }));
vi.mock("@/lib/smarttag.functions", () => ({
  listSmartTags: mocks.list, createSmartTag: mocks.create, chargeSmartTag: mocks.charge,
  listSoundboxes: mocks.listBoxes, registerSoundbox: mocks.registerBox, updateSoundbox: mocks.updateBox, unlinkSoundbox: mocks.unlinkBox,
  tagUrl: (h: string) => `https://pay.slikpay.africa/@${h}`,
  TAG_CURRENCIES: ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"],
  SOUNDBOX_VOICES: ["English", "Pidgin", "Hausa", "Yorùbá", "Igbo"],
}));
vi.mock("@/components/slikpay/PaddleConsole", () => ({ useBankingProfile: () => ({ profile: { mode: "sandbox", balances: {}, receipts: [] }, error: "", refresh: vi.fn() }) }));
import { SmartTag } from "@/components/slikpay/SmartTag";

const TAGS = [
  { handle: "adaeze-kitchen", name: "Adaeze Kitchen — Counter 1", amount: 5000, currency: "NGN", checkoutUrl: "https://pay.example.com/t1", createdAt: "2026-10-01T10:00:00Z" },
  { handle: "table-7", name: "Table 7", amount: null, currency: "NGN", checkoutUrl: null, createdAt: "2026-10-05T10:00:00Z" },
];
const CHARGES = [
  { reference: "SLKTAG-1", url: "https://pay.example.com/c1", amount: 2500, currency: "NGN", handle: "table-7", createdAt: "2026-10-06T10:00:00Z", status: "paid" as const },
];

describe("QR & SmartTag page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ mode: "sandbox", tags: TAGS, charges: CHARGES });
    mocks.listBoxes.mockResolvedValue({ soundboxes: [] });
  });

  it("lists tags with fixed/open amounts and live charge statuses", async () => {
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    expect(screen.getByText("@table-7")).toBeTruthy();
    expect(screen.getByText(/Fixed · 5,000.00 NGN/)).toBeTruthy();
    expect(screen.getByText(/Open amount · NGN/)).toBeTruthy();
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.queryByText(/paddle|sterling/i)).toBeNull();
  });

  it("creates a tag through the server function", async () => {
    mocks.create.mockResolvedValue({ handle: "new-stand", name: "New Stand", amount: null, currency: "NGN", checkoutUrl: null, createdAt: "2026-10-29T00:00:00Z" });
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    const form = screen.getByRole("form", { name: "Create SmartTag" });
    fireEvent.change(within(form).getByLabelText("Display name"), { target: { value: "New Stand" } });
    fireEvent.change(within(form).getByLabelText("Tag name"), { target: { value: "new-stand" } });
    fireEvent.change(within(form).getByLabelText("Contact email"), { target: { value: "ada@example.com" } });
    fireEvent.click(within(form).getByRole("button", { name: /^Create SmartTag$/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ handle: "new-stand", name: "New Stand", currency: "NGN" }) }));
    await waitFor(() => expect(screen.getByText("@new-stand")).toBeTruthy());
  });

  it("charges an open-amount tag and shows the payment QR", async () => {
    mocks.charge.mockResolvedValue({ reference: "SLKTAG-new", url: "https://pay.example.com/new", amount: 1500, currency: "NGN", handle: "table-7", createdAt: "2026-10-29T00:00:00Z", status: "awaiting" });
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@table-7")).toBeTruthy());
    const card = screen.getByText("@table-7").closest("li")!;
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "New charge" }));
    const dialog = await screen.findByRole("dialog", { name: "Charge @table-7" });
    fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: "1500" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Start charge$/i }));
    await waitFor(() => expect(mocks.charge).toHaveBeenCalledWith({ data: expect.objectContaining({ handle: "table-7", amount: 1500, reference: expect.stringMatching(/^SLKTAG-/) }) }));
    await waitFor(() => expect(screen.getByText(/Charge ready — 1,500.00 NGN/)).toBeTruthy());
  });

  it("shows the safe error when loading fails", async () => {
    mocks.list.mockRejectedValue(new Error("Your SmartTags could not be loaded. Try again."));
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy();
  });

  it("renders the QR stand builder and the soundbox registration form", async () => {
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /QR stands/i }));
    await waitFor(() => expect(screen.getByText("Printable QR stand")).toBeTruthy());
    expect(screen.getByLabelText("QR stand preview for @adaeze-kitchen")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Soundboxes/i }));
    await waitFor(() => expect(screen.getByRole("form", { name: "Register soundbox" })).toBeTruthy());
    expect(screen.getByText("No soundboxes registered")).toBeTruthy();
  });

  it("registers a soundbox linked to a SmartTag", async () => {
    mocks.registerBox.mockResolvedValue({ deviceId: "SLK-BOX-0001", label: "Front counter", handle: "adaeze-kitchen", voice: "English", createdAt: "2026-10-29T00:00:00Z" });
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Soundboxes/i }));
    const form = await screen.findByRole("form", { name: "Register soundbox" });
    fireEvent.change(within(form).getByLabelText("Device ID"), { target: { value: "SLK-BOX-0001" } });
    fireEvent.change(within(form).getByLabelText("Counter name"), { target: { value: "Front counter" } });
    fireEvent.click(within(form).getByRole("button", { name: /^Register soundbox$/i }));
    await waitFor(() => expect(mocks.registerBox).toHaveBeenCalledWith({ data: expect.objectContaining({ deviceId: "SLK-BOX-0001", label: "Front counter", handle: "adaeze-kitchen", voice: "English" }) }));
    await waitFor(() => expect(screen.getByText("Front counter")).toBeTruthy());
  });

  it("lists soundboxes with live payment status and unlinks one", async () => {
    mocks.listBoxes.mockResolvedValue({ soundboxes: [{ deviceId: "SLK-BOX-0001", label: "Front counter", handle: "table-7", voice: "Pidgin", createdAt: "2026-10-01T10:00:00Z" }] });
    mocks.unlinkBox.mockResolvedValue({ deviceId: "SLK-BOX-0001" });
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Soundboxes/i }));
    await waitFor(() => expect(screen.getByText("Front counter")).toBeTruthy());
    expect(screen.getByText(/Announces payments to @table-7 · Pidgin/)).toBeTruthy();
    expect(screen.getByText("2,500.00 NGN")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unlink Front counter" }));
    await waitFor(() => expect(mocks.unlinkBox).toHaveBeenCalledWith({ data: { deviceId: "SLK-BOX-0001" } }));
    await waitFor(() => expect(screen.queryByText("Front counter")).toBeNull());
  });

  it("edits a soundbox label and voice without changing the device ID", async () => {
    mocks.listBoxes.mockResolvedValue({ soundboxes: [{ deviceId: "SLK-BOX-0001", label: "Front counter", handle: "table-7", voice: "English", createdAt: "2026-10-01T10:00:00Z" }] });
    mocks.updateBox.mockResolvedValue({ deviceId: "SLK-BOX-0001", label: "Back counter", handle: "table-7", voice: "Hausa", createdAt: "2026-10-01T10:00:00Z" });
    render(<SmartTag />);
    await waitFor(() => expect(screen.getByText("@adaeze-kitchen")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Soundboxes/i }));
    await waitFor(() => expect(screen.getByText("Front counter")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Edit Front counter" }));
    const form = await screen.findByRole("form", { name: "Edit Front counter" });
    expect((within(form).getByLabelText("Device ID") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText("Counter name"), { target: { value: "Back counter" } });
    fireEvent.click(within(form).getByRole("button", { name: "Hausa" }));
    fireEvent.click(within(form).getByRole("button", { name: /^Save changes$/i }));
    await waitFor(() => expect(mocks.updateBox).toHaveBeenCalledWith({ data: { deviceId: "SLK-BOX-0001", label: "Back counter", voice: "Hausa" } }));
    await waitFor(() => expect(screen.getByText("Back counter")).toBeTruthy());
  });
});
