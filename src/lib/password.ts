export type Strength = "Weak" | "Medium" | "Strong";

/** Score: length ≥ 8, mixed case, digit, symbol. 0-2 Weak, 3 Medium, 4 Strong. */
export function passwordStrength(pw: string): { label: Strength; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return { score, label: score >= 4 ? "Strong" : score === 3 ? "Medium" : "Weak" };
}

export const isEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e);
export const isPin = (p: string) => /^\d{4}$/.test(p);
