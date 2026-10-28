export function retryAfterSeconds(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now) / 1000)) : null;
}

// Only return approved descriptions, never echo provider payloads containing PII.
export function paddleFailure(status: number, payload: unknown, retryAfter: string | null, rateLimitReset: string | null = null, now = Date.now()) {
  const text = JSON.stringify(payload ?? {}).toLowerCase();
  if (/insufficient.*(balance|fund|credit)|low.balance|payment.required|quota.exceeded/.test(text)) return "Paddle could not send the code because its SMS balance or quota is exhausted. Check your Paddle SMS credits and quota.";
  if (status === 429) {
    const reset = rateLimitReset ? Number(rateLimitReset) : NaN;
    const seconds = Math.max(1, retryAfterSeconds(retryAfter, now) ?? (Number.isFinite(reset) && reset * 1000 > now ? Math.ceil((reset * 1000 - now) / 1000) : 60));
    return `Paddle is limiting verification requests (HTTP 429). Wait before trying again. [retry-after:${seconds}]`;
  }
  return `Paddle verification failed (HTTP ${status}).`;
}

export function verificationRetry(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not send a verification code.";
  const match = message.match(/\[retry-after:(\d+)\]/);
  return { message: message.replace(/\s*\[retry-after:\d+\]/, ""), seconds: match ? Number(match[1]) : 0 };
}