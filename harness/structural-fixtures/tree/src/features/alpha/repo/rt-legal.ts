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

// A CONTAINER of nothing is not an untyped operand. `typeof rows` is statically
// `"object"` and decides nothing — the shared `typeResolvesToFlags` reading, which
// is right for a parameter and a return, is wrong here, and this is what pins the
// split.
export function countSettlementRows(text: string): number {
  const rows: unknown[] = JSON.parse(text);
  return typeof rows === "object" ? rows.length : 0;
}

// A UNION with a broad member is the compiler's own narrowing, same as
// `string | number`. `typeResolvesToFlags` calls this broad; the operand itself
// is not.
export function describeSettlementBag(text: string): string {
  const value: object | string = JSON.parse(text);
  return typeof value === "string" ? value : "bag";
}

// A `this is T` predicate publishes a narrowing contract exactly as `value is T`
// does, so the `typeof` that IS its parse step is exempt. The predicate's subject
// is a `ThisType` node with no `text`, and a reader of `text` alone calls this
// function "not a guard" — then reports a line whose author has no signature left
// to write.
export function isSettlementLedger(this: unknown): this is { total: number } {
  return typeof this === "object" && this !== null;
}
