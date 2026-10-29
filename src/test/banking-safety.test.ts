import { describe, expect, it } from "vitest";
import * as apiModule from "@/lib/api";

describe("banking safety", () => {
  it("ships no mocked payments, demo accounts or offline success fallbacks", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(`${process.cwd()}/src/lib/api.ts`, "utf8"),
    );
    expect(source).not.toMatch(/mock|demo|fallback/i);
    expect("api" in apiModule).toBe(false);
    expect("MOCK_TXNS" in apiModule).toBe(false);
    expect("MOCK_ACCOUNT" in apiModule).toBe(false);
  });
});
