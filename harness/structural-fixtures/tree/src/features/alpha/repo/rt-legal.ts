// LEGAL neighbours for `types/no-runtime-typeof`, and the first two are the
// behaviour change this check's header calls a redesign. Its syntactic
// predecessor reported both and said so in its own header.

// The SSR guard. `window` is `Window & typeof globalThis` — a type — and the
// test is about existence, not shape.
export const isSettlementServer = typeof window === "undefined";

// Discriminating a union the compiler already narrows. This is TypeScript's own
// narrowing mechanism, not a parser written inline.
export function describeSettlementValue(value: string | number): string {
  return typeof value === "string" ? value : String(value);
}

// Inside a guard the same test IS the parse step, and every caller narrows
// through the one contract it publishes.
export function isSettlementText(value: unknown): value is string {
  return typeof value === "string";
}
