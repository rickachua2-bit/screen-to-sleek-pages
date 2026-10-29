import { expect, it } from "vitest";
import { consolePaymentStatus, consoleReceiptMessage, whiteLabelConsoleText } from "@/lib/console-safety";
it("never settles a successful HTTP response without an explicit final status", () => {
  expect(consolePaymentStatus({ success: true })).toBe("pending");
  expect(consolePaymentStatus({ status: "PENDING" })).toBe("pending");
  expect(consolePaymentStatus({ status: "COMPLETED" })).toBe("succeeded");
  expect(consolePaymentStatus({ status: "DECLINED" })).toBe("failed");
  expect(consolePaymentStatus({ status: "COMPLETED", success: false })).toBe("pending");
});
it("does not present a pending or failed receipt as confirmed", () => {
  expect(consoleReceiptMessage("pending")).not.toMatch(/confirmed/i);
  expect(consoleReceiptMessage("failed")).not.toMatch(/confirmed/i);
});
it("removes provider branding from console text", () => {
  expect(whiteLabelConsoleText("Paddlebus via Sterling Bank")).toBe("Slikpay via partner bank");
});