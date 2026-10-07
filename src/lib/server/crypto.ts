import crypto from "node:crypto";

export function generateShareToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function tokensEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}
