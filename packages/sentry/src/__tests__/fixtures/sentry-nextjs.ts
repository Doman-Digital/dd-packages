/** Stands in for `@sentry/nextjs` (aliased in vitest.config.ts) and records what it was called with. */

export const calls: { fn: string; args: unknown[] }[] = [];

export function captureRequestError(...args: unknown[]): void {
  calls.push({ fn: "captureRequestError", args });
}

export function captureException(...args: unknown[]): string {
  calls.push({ fn: "captureException", args });
  return "event-id";
}
