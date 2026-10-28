import { describe, expect, it } from "vitest";
import { loginCodeSchema } from "@/lib/login-2fa.functions";

const ID = "0f3d2a1e-9c4b-4a5b-8c6d-7e8f9a0b1c2d";

describe("sign-in 2FA email code", () => {
  it("accepts a 6-digit code with a valid challenge id", () => {
    expect(loginCodeSchema.safeParse({ challengeId: ID, code: "482910" }).success).toBe(true);
  });

  it("rejects codes that are not exactly 6 digits", () => {
    for (const code of ["12345", "1234567", "abcdef", "12 456", ""]) {
      expect(loginCodeSchema.safeParse({ challengeId: ID, code }).success).toBe(false);
    }
  });

  it("rejects a missing or malformed challenge id", () => {
    expect(loginCodeSchema.safeParse({ challengeId: "not-a-uuid", code: "482910" }).success).toBe(false);
    expect(loginCodeSchema.safeParse({ code: "482910" }).success).toBe(false);
  });
});
