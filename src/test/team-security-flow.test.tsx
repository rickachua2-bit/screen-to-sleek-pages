import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), pin: vi.fn(), invite: vi.fn(), revoke: vi.fn(), update: vi.fn(), signin: vi.fn(), factors: vi.fn(), verify: vi.fn(), signout: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (name: string) => name === "get" ? mocks.get : name === "pin" ? mocks.pin : name === "invite" ? mocks.invite : name === "revoke" ? mocks.revoke : mocks.save }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/team-security.functions", () => ({ getTeamSecurity: "get", saveDisplayName: "save", changeTransactionPin: "pin", sendTeamInvitation: "invite", revokeTeamInvitation: "revoke" }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { email: "owner@example.com" }, refresh: vi.fn(), signOut: vi.fn() }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signInWithPassword: mocks.signin, updateUser: mocks.update, signOut: mocks.signout, mfa: { listFactors: mocks.factors, challengeAndVerify: mocks.verify } } } }));
import { TeamSecurity } from "@/components/slikpay/TeamSecurity";
const data = { owner: { name: "Ada", email: "owner@example.com", company: "Ada Ltd", registration: "RC1" }, teamConnected: true, auditConnected: true, pinConfigured: true, authenticator: true, invites: [], events: [] };
beforeEach(() => { vi.resetAllMocks(); mocks.get.mockResolvedValue(data); });
const tab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
it("does not enable invitation sending when the team service is not connected", async () => {
  mocks.get.mockResolvedValue({ ...data, teamConnected: false });
  render(<TeamSecurity />);
  await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
  expect((screen.getByRole("button", { name: "Invite a colleague" }) as HTMLButtonElement).disabled).toBe(true);
});
it("submits PIN replacement only after matching confirmation", async () => {
  render(<TeamSecurity />); await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
  tab("Security"); fireEvent.click(await screen.findByRole("button", { name: "Change PIN" }));
  fireEvent.change(screen.getByLabelText("Current PIN"), { target: { value: "1234" } });
  fireEvent.change(screen.getByLabelText("New PIN"), { target: { value: "5678" } });
  fireEvent.change(screen.getByLabelText("Confirm new PIN"), { target: { value: "5678" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.pin).toHaveBeenCalledWith({ data: { currentPin: "1234", newPin: "5678" } }));
});
it("does not change password when current-password verification fails", async () => {
  mocks.signin.mockResolvedValue({ error: new Error("wrong") });
  render(<TeamSecurity />); await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
  tab("Security"); fireEvent.click(await screen.findByRole("button", { name: "Change password" }));
  for (const [label, value] of [["Current password", "wrong"], ["New password", "NewSecret12"], ["Confirm new password", "NewSecret12"], ["Authenticator code", "123456"]] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.signin).toHaveBeenCalled());
  expect(mocks.update).not.toHaveBeenCalled();
});
it("sends the validated requested role with the owner PIN, not access permissions", async () => {
  mocks.invite.mockResolvedValue({ ok: true });
  render(<TeamSecurity />); await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Invite a colleague" }));
  for (const [label, value] of [["Full name", "Grace"], ["Work email", "grace@example.com"], ["Transaction PIN", "1234"]] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.invite).toHaveBeenCalledWith({ data: { name: "Grace", email: "grace@example.com", role: "viewer", pin: "1234" } }));
});
it("saves profile edits and reloads the persisted profile", async () => {
  mocks.save.mockResolvedValue({ ok: true });
  render(<TeamSecurity />); await waitFor(() => expect(screen.getByText("Ada")).toBeTruthy());
  tab("Profile");
  fireEvent.change(await screen.findByLabelText("Display name"), { target: { value: "Ada Grace" } });
  mocks.get.mockResolvedValue({ ...data, owner: { ...data.owner, name: "Ada Grace" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ data: { name: "Ada Grace" } }));
  await waitFor(() => expect((screen.getByLabelText("Display name") as HTMLInputElement).value).toBe("Ada Grace"));
});