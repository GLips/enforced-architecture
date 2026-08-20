// Rule options arrive from the user's config file as unvalidated JSON — `Options` is `JsonValue[]`,
// so `context.options[0]` is `string | number | boolean | JsonObject | JsonValue[]` and reading a
// property off it does not typecheck. `meta.schema` is oxlint's contract with the CONFIG FILE, not
// a type this side of the boundary gets to assume held: a rule that trusts it reads `undefined` as
// a threshold and compares every count against NaN, which is false for every count — a rule that
// silently governs nothing.
//
// Narrowing it once here is what keeps a second optioned rule from pasting a third near-copy of
// the same guard.

/** The numeric option named `key` on a rule's first option object, or `fallback` when absent. */
export function numericRuleOption(option: unknown, key: string, fallback: number): number {
  if (typeof option !== "object" || option === null || !(key in option)) return fallback;
  const value = (option as Record<string, unknown>)[key];
  return typeof value === "number" ? value : fallback;
}
