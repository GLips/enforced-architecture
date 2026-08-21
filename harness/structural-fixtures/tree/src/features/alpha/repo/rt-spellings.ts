// ADVERSARIAL for `types/no-runtime-typeof`: the same decision written as an
// expression rather than a statement, over each of the three untyped spellings,
// plus the callback that a guard's promise does not reach into.

export function ternarySettlementKind(text: string): string {
  const parsed: unknown = JSON.parse(text);
  return typeof parsed === "number" ? "number" : "other";
}

export function anySettlementKind(loose: { value: any }): string {
  return typeof loose.value === "string" ? "string" : "other";
}

export function objectSettlementKind(holder: { value: object }): string {
  return typeof holder.value === "function" ? "function" : "other";
}

// The nearest enclosing function is the CALLBACK, which declares no predicate.
// A walk that stopped at the outermost guard would exempt this, and the guard's
// contract says nothing about what the callback decides.
export function isSettlementStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// An untyped RECEIVER with no predicate to publish. `types/no-broad-parameters`
// is silent on a `this` annotation by design, so this line is the only place the
// defect surfaces at all.
export function readsSettlementReceiver(this: unknown): string {
  return typeof this === "object" ? "bag" : "other";
}
