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
