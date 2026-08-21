// ADVERSARIAL for `types/no-broad-parameters`: the other spellings, the other
// signature positions, and the guard that vouches for one input and not the
// second.

// `any` sits beside `unknown`, because banning one alone teaches the other.
export function acceptsAnySettlement(payload: any): string {
  return String(payload);
}

// `object` is a different mistake and gets a different sentence.
export function acceptsObjectSettlement(payload: object): string {
  return String(payload);
}

// A method signature on an interface is a call signature the walk has to reach;
// a check that only visited function declarations is silent on every interface
// in the tree.
export interface SettlementSink {
  accept(item: unknown): void;
}

// An arrow is the third position.
export const acceptsViaArrow = (payload: unknown): string => String(payload);

// A container of `unknown` is still `unknown` at the call site.
export function acceptsPendingSettlement(payload: Promise<unknown>): Promise<string> {
  return payload.then(String);
}

// A guard vouches for ONE parameter. The second is not covered by the predicate
// and still reports, which is what stops `value is T` from being a blanket hatch.
export function isSettlementIdWithExtra(value: unknown, extra: unknown): value is string {
  return typeof value === "string" && extra !== undefined;
}

// A UNION burying the broad member. At the call site this accepts anything, so
// it is the same defect as a bare `unknown` — and it is the one shape that pins
// `typeResolvesToFlags`' union arm, which every check in this tag routes through.
export function acceptsUnionSettlement(payload: string | unknown): string {
  return String(payload);
}


// A REST parameter. One annotation, one subject, and the array it is spelled
// with is the container arm rather than a second case.
export function acceptsSettlementRest(...items: unknown[]): number {
  return items.length;
}

// A DEFAULTED parameter. The default is a value, and this check reads
// declarations — so the initialiser does not narrow anything and the annotation
// still says nothing.
export function acceptsDefaultedSettlement(payload: any = {}): string {
  return String(payload);
}

// A PARAMETER PROPERTY, which declares a field and a parameter in one token. The
// caller still passes it, so it is an input and reports as one.
export class SettlementBox {
  constructor(private readonly contents: unknown) {}

  size(): number {
    return String(this.contents).length;
  }
}

// The two `TRANSPARENT_CONTAINER_NAMES` entries no other fixture reaches.
// Remove either name from that set and this file reports eleven instead of
// thirteen — which is the only way a shortened coverage list is visible at all.
export function acceptsReadonlySettlements(items: ReadonlyArray<unknown>): number {
  return items.length;
}

export function acceptsThenableSettlement(pending: PromiseLike<unknown>): PromiseLike<string> {
  return pending.then(String);
}

// FIVE containers deep. The unwrap used to stop at four and answer "not broad"
// here, which is a hole with a number on it rather than a stated one.
export function acceptsDeeplyPendingSettlement(
  pending: Promise<Promise<Promise<Promise<Promise<unknown>>>>>,
): void {
  void pending;
}
