import { describeRule } from "../lib/rule-spec.ts";
import { noWidenThenAssertRule } from "./no-widen-then-assert.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

// The upstream rule this is modelled on ships no spec at all, so every case here is written from
// the implementation rather than adapted from one. The legal list matters more than usual as a
// result: it is the only thing standing between this rule and the flows it must not touch.
describeRule("types/no-widen-then-assert", noWidenThenAssertRule, {
  obvious: [
    {
      name: "the three-line round trip the rule is named for",
      filename: SERVICE,
      code: `export function load(): User {
  const loaded: User = fetchUser();
  const stored: unknown = loaded;
  return stored as User;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "widened to any rather than unknown",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: any = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
  ],

  adversarial: [
    {
      // The other spelling of the same widening. A rule reading only the declared annotation
      // misses it entirely, and an agent picks between the two arbitrarily.
      name: "widened by an assertion on the initializer instead of an annotation",
      filename: SERVICE,
      code: `export function load(): User {
  const loaded: User = fetchUser();
  const stored = loaded as unknown;
  return stored as User;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "the angle-bracket spelling of the recovering assertion",
      filename: SERVICE,
      code: `export function load(): User {
  const loaded: User = fetchUser();
  const stored: unknown = loaded;
  return <User>stored;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      // Locks in the parser behaviour this rule leans on: oxlint surfaces no parenthesis nodes,
      // so the unwrapping every upstream helper carries is dead code here. If a future version
      // starts surfacing them, this case goes red instead of the rule going quietly silent.
      name: "parentheses around the value and the type are not an escape",
      filename: SERVICE,
      code: `export function load(): User {
  const loaded: User = fetchUser();
  const stored: unknown = (loaded);
  return (stored) as (User);
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "a value that is its own evidence, with no annotation anywhere",
      filename: SERVICE,
      code: `export function load(): Config {
  const stored: unknown = { retries: 3 };
  return stored as Config;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "laundered through an intermediate const before the widening",
      filename: SERVICE,
      code: `export function load(): User {
  const loaded: User = fetchUser();
  const copied = loaded;
  const stored: unknown = copied;
  return stored as User;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "widened to the object keyword rather than a top type",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: object = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "widened to an open dictionary, the third spelling of the same loss",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: Record<string, unknown> = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      // `object` as a dictionary VALUE is the same bag, and bare `object` is broad here already —
      // a rule that stops at top types leaves this one spelling of the same loss standing.
      name: "widened to a dictionary of objects, which erases every value's shape",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: Record<string, object> = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      // The mapped-type spelling of the same bag, one keystroke off `{ [k: string]: unknown }`. A
      // rule reading only `Record` and index signatures buys nothing but the keystroke.
      name: "widened to the mapped-type spelling of an open dictionary",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: { [K in string]: unknown } = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "widened to a mapped type over the number key domain",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: { [K in number]: unknown } = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "widened to a mapped type over the symbol key domain",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: { [K in symbol]: unknown } = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "widened to a number-keyed index signature",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: { [k: number]: unknown } = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      // One typed member beside the index signature does not close the key domain: the type still
      // accepts every string key. Requiring the literal to hold nothing else is the cheapest way
      // out of the rule.
      name: "one named field beside the index signature does not make it a shape",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: { id: string; [k: string]: unknown } = invoice;
  return stored as Invoice;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      // The bag reached through a local alias. Type aliases are routinely declared below the
      // function that widens through them, which is why they are collected from `Program` up front.
      name: "widened through a local alias to the bag, declared below the use",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: Bag = invoice;
  return stored as Invoice;
}
type Bag = Record<string, unknown>;`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      // The RECOVERY half of the same question, where the drift is easiest to leave behind. A
      // narrower dictionary matched by the name `Record` is blind to the mapped-type spelling of
      // itself, and a recovery it cannot see is a report it silently drops.
      name: "recovered into the mapped-type spelling of a narrower dictionary",
      filename: SERVICE,
      code: `export function load(): { [K in string]: Handler } {
  const handlers: Record<string, Handler> = buildHandlers();
  const stored: Record<string, unknown> = handlers;
  return stored as { [K in string]: Handler };
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "recovered into a narrower dictionary named by a local alias",
      filename: SERVICE,
      code: `export function load(): Handlers {
  const handlers: Record<string, Handler> = buildHandlers();
  const stored: Record<string, unknown> = handlers;
  return stored as Handlers;
}
type Handlers = Record<string, Handler>;`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "asserted to something unrelated, which is still evidence invented from nothing",
      filename: SERVICE,
      code: `export function load(): AccountId {
  const loaded: User = fetchUser();
  const stored: unknown = loaded;
  return stored as AccountId;
}`,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      name: "two independent round trips in one function are two findings",
      filename: SERVICE,
      code: `export function load(): [User, Invoice] {
  const user: User = fetchUser();
  const storedUser: unknown = user;
  const invoice: Invoice = buildInvoice();
  const storedInvoice: unknown = invoice;
  return [storedUser as User, storedInvoice as Invoice];
}`,
      errors: [{ messageId: "widenThenAssert" }, { messageId: "widenThenAssert" }],
    },
  ],

  legal: [
    {
      // The flow this rule must never touch. The value genuinely arrives untyped, so the assertion
      // is a boundary-parsing question, not a pointless round trip.
      name: "a value that was never known — parsed from text",
      filename: SERVICE,
      code: `export function load(text: string): User {
  const stored: unknown = JSON.parse(text);
  return stored as User;
}`,
    },
    {
      name: "an already-unknown parameter carries no evidence to discard",
      filename: SERVICE,
      code: `export function load(input: unknown): User {
  const stored: unknown = input;
  return stored as User;
}`,
    },
    {
      name: "a bare call result is a boundary, not a widening",
      filename: SERVICE,
      code: `export function load(): User {
  const stored: unknown = fetchRawUser();
  return stored as User;
}`,
    },
    {
      name: "the fix the message asks for — the type kept through to the use",
      filename: SERVICE,
      code: `export function load(): User {
  const loaded: User = fetchUser();
  return loaded;
}`,
    },
    {
      name: "widening with no assertion afterwards is not this rule's business",
      filename: SERVICE,
      code: `export function log(): void {
  const loaded: User = fetchUser();
  const stored: unknown = loaded;
  record(stored);
}`,
    },
    {
      name: "an assertion that widens rather than recovers",
      filename: SERVICE,
      code: `export function load(): unknown {
  const loaded: User = fetchUser();
  const stored: unknown = loaded;
  return stored as any;
}`,
    },
    {
      // The assertion reads a binding declared later, so it cannot be recovering from that
      // widening. A rule matching on name alone reports here.
      name: "an assertion earlier in the file than the widening it appears to match",
      filename: SERVICE,
      code: `export function first(stored: RawRow): User {
  return stored as User;
}
export function second(): void {
  const loaded: User = fetchUser();
  const stored: unknown = loaded;
  record(stored);
}`,
    },
    {
      name: "widening and assertion split across a closure boundary",
      filename: SERVICE,
      code: `export function load(): () => User {
  const loaded: User = fetchUser();
  const stored: unknown = loaded;
  return () => stored as User;
}`,
    },
    {
      name: "a reassigned binding is not a flow the rule can follow",
      filename: SERVICE,
      code: `export function load(): User {
  const loaded: User = fetchUser();
  let stored: unknown = loaded;
  stored = fetchOther();
  return stored as User;
}`,
    },
    {
      // THE DIVERGENCE ROW. `types/no-known-value-widening` reports this exact annotation, because
      // what it watches is a literal losing its keys. Here the value type is precise, so the
      // dictionary is a real keyed collection and holding a `User` in one discards nothing.
      // If this ever reports, the two rules have collapsed into one and the key/value split is gone.
      name: "a dictionary with a precise value type is a collection, not a widening",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: Record<string, Handler> = invoice;
  return stored as Invoice;
}`,
    },
    {
      // A closed key domain is a named shape, not a bag — the same reading that keeps a dirty-field
      // tracker legal in `types/no-opaque-record`.
      name: "a closed key domain is a shape the value can honestly hold",
      filename: SERVICE,
      code: `export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: Record<"draft" | "paid", unknown> = invoice;
  return stored as Invoice;
}`,
    },
    {
      // An assertion from one bag to another recovers nothing, so there is no invented type to
      // report — and `types/no-opaque-record` reports the target anyway, which is what keeps the
      // two messages jointly actionable instead of an edit loop. The recovery test asks the shared
      // opaque-value question, so `object` under closed keys is still a bag here.
      name: "asserting from one bag to another is not a recovery",
      filename: SERVICE,
      code: `export function load(): Record<"draft" | "paid", object> {
  const invoice: Invoice = buildInvoice();
  const stored: Record<string, unknown> = invoice;
  return stored as Record<"draft" | "paid", object>;
}`,
    },
    {
      // The open-keyed twin of the case above, and the one that pins the recovery test asking the
      // shared opaque-value question rather than only about top types.
      name: "recovering into another open bag recovers nothing",
      filename: SERVICE,
      code: `export function load(): Record<string, object> {
  const invoice: Invoice = buildInvoice();
  const stored: Record<string, unknown> = invoice;
  return stored as Record<string, object>;
}`,
    },
    {
      // The mapped type's key binder shadows the module alias in the VALUE position, and only
      // there. Asking the value question with the shadow set computed at the mapped type never
      // sees the binder, resolves `Key` to `unknown`, and invents a widening that was not written.
      name: "a mapped key binder shadows an alias of the same name in the value",
      filename: SERVICE,
      code: `type Key = unknown;
export function load(): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: { [Key in string]: Key } = invoice;
  return stored as Invoice;
}`,
    },
    {
      // `Bag` here is the function's own type parameter, so the annotation says nothing about
      // `Record`. Because aliases ARE resolved, a file that names a generic after one of them is
      // exactly where this rule would invent a widening that was never written.
      name: "a type parameter that shadows an alias to the bag is not a widening",
      filename: SERVICE,
      code: `type Bag = Record<string, unknown>;
export function load<Bag>(seed: Bag): Invoice {
  const invoice: Invoice = buildInvoice();
  const stored: Bag = invoice;
  return stored as Invoice;
}`,
    },
    {
      name: "as const narrows a literal and discards nothing",
      filename: SERVICE,
      code: `export function statuses() {
  const values = ["draft", "paid"] as const;
  return values;
}`,
    },
    {
      name: "a test file may stage whatever fixture flow it needs",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `const loaded: User = fetchUser();
const stored: unknown = loaded;
const user = stored as User;`,
    },
  ],
});
