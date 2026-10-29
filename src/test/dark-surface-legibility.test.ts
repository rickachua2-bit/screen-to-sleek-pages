import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
const block = css.slice(css.indexOf("/* ============ Dark surface legibility"));

const darkSurfaces = [
  ".theme-flame",
  ".merchant-sidebar",
  ".topbar-midnight",
  ".light-workspace .hero-surface",
  ".receiving-account",
  ".transfer-story",
  ".qr-stand",
  ".bg-navy-rail",
  ".bulk-studio-overview",
  ".team-studio-rail",
  ".developer-console-banner",
  ".developer-studio-rail",
  ".mission-navigation",
  ".mission-code",
  ".slik-popup",
  ".slik-dropdown",
  ".merchant-popover",
  "[data-sonner-toast]",
];

describe("dark surface legibility", () => {
  it("declares a white-text token layer for dark surfaces", () => {
    expect(block.length).toBeGreaterThan(200);
    expect(block).toContain("--foreground: oklch(1 0 0)");
    expect(block).toContain("--muted-foreground: oklch(0.92 0.012 250)");
  });

  for (const surface of darkSurfaces) {
    it(`keeps text bright white on ${surface}`, () => {
      expect(block).toContain(surface);
    });
  }

  it("never dims white copy on the navy rails", () => {
    for (const file of ["Airtime", "BillsService", "MobileData", "InternationalServices", "DashboardPlus", "CurrencyWallet", "SmartTag"]) {
      const source = readFileSync(`${process.cwd()}/src/components/slikpay/${file}.tsx`, "utf8");
      expect(source, file).not.toMatch(/text-(white|foreground|primary-foreground)\/(?:2\d|3\d|4\d|5\d|6\d|7[0-4])\b/);
    }
  });
});
