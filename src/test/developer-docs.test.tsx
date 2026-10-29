import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@/lib/business-keys.functions", () => ({ listBusinessKeys: {}, manageBusinessKey: {} }));

import { BusinessApiDocs } from "@/components/slikpay/BusinessApiKeys";

it("opens the official documentation site from the developer console docs tab", () => {
  render(<BusinessApiDocs />);
  const open = screen.getByRole("link", { name: /open full documentation/i });
  expect(open).toHaveAttribute("href", "https://docs.slikpay.online");
  expect(open).toHaveAttribute("target", "_blank");
  expect(open).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
});

it("deep-links each guide to its anchor on the documentation site", () => {
  render(<BusinessApiDocs />);
  expect(screen.getByRole("link", { name: /webhooks & signature verification/i })).toHaveAttribute("href", "https://docs.slikpay.online/#section-webhooks");
  expect(screen.getByRole("link", { name: /error codes & HTTP handling/i })).toHaveAttribute("href", "https://docs.slikpay.online/#section-errors");
});
