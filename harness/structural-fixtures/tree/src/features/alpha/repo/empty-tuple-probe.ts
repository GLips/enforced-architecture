// A CRASH PROBE, not a violation fixture, and it is expected to draw nothing.
//
// TypeScript 7.0.2's response encoder panics on one request in this file —
// `interface conversion: checker.TypeData is *checker.TypeReference, not
// *checker.TupleType` — and `isTypeRequestUnsafe` in `type-shapes.ts` is the one
// line standing between that panic and every `types/` check in the run. Delete
// that line and this file turns the suite red, which is the only reason it is
// here.
//
// Every neighbouring spelling of the empty tuple is here too, because they are
// what says the skip is NARROW. Each of these answers fine, and a guard widened
// to cover them would be skipping real subjects for a crash they do not cause.

// THE PANIC. The `const` in `as const` parses as a type reference named `const`,
// and that reference is the request that kills the server.
export const emptyMarker = [] as const;

// FINE, all of them.
export const emptyRows = [];
export type EmptyTuple = [];
export const annotatedEmpty: [] = [];
export const namedEmpty: EmptyTuple = [];
export function readsEmpty(rows: EmptyTuple): number {
  return rows.length;
}
