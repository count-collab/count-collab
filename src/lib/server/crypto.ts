import crypto from "node:crypto";

export function generateShareToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}
