import { describe, expect, it } from "vitest";
import { isPin, passwordStrength } from "@/lib/password";

describe("password strength", () => {
  it("short lowercase password is Weak", () => expect(passwordStrength("abc").label).toBe("Weak"));
  it("8+ chars, mixed case and digit is Medium", () => expect(passwordStrength("Abcdefg1").label).toBe("Medium"));
  it("adding a symbol makes it Strong", () => expect(passwordStrength("Abcdefg1!").label).toBe("Strong"));
});

describe("security PIN", () => {
  it("must be exactly 4 digits", () => {
    expect(isPin("1234")).toBe(true);
    expect(isPin("123")).toBe(false);
    expect(isPin("12a4")).toBe(false);
  });
});
