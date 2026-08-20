import { describeRule } from "../lib/rule-spec.ts";
import { noModuleMockingRule } from "./no-module-mocking.ts";

// This rule's cases live in TEST files, because that is the only place module mocks appear. Every
// other oxlint rule in the catalog treats these paths as exempt.
const SPEC = "/repo/src/features/billing/service/invoices.test.ts";
const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("testing/no-module-mocking", noModuleMockingRule, {
  obvious: [
    {
      name: "the Vitest module mock the rule is named for",
      filename: SPEC,
      code: `vi.mock("./user-store");`,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      name: "the Jest spelling",
      filename: SPEC,
      code: `jest.mock("./user-store");`,
      errors: [{ messageId: "moduleMock" }],
    },
  ],

  adversarial: [
    {
      // The rule must survive the catalog's own convention. Every other rule skips *.test.ts, and
      // inheriting that exemption here would make this rule match nothing at all.
      name: "a test file is exactly where this must report, not be exempt",
      filename: "/repo/src/features/billing/repo/__tests__/invoices.spec.ts",
      code: `vi.mock("../user-store");`,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      name: "the explicitly imported binding rather than the injected global",
      filename: SPEC,
      code: `import { vi } from "vitest";
vi.mock("./user-store");`,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      name: "the Jest binding imported from its globals module",
      filename: SPEC,
      code: `import { jest } from "@jest/globals";
jest.mock("./user-store");`,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      name: "the deferred variant, which a rule matching only mock misses",
      filename: SPEC,
      code: `vi.doMock("./user-store");`,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      name: "the ESM-era Jest variant under its unstable name",
      filename: SPEC,
      code: `jest.unstable_mockModule("./user-store", () => ({}));`,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      name: "the computed spelling of the method",
      filename: SPEC,
      code: `vi["mock"]("./user-store");`,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      name: "called with a factory rather than bare",
      filename: SPEC,
      code: `vi.mock("./user-store", () => ({ loadUser: () => null }));`,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      name: "two mocks in one file are two findings",
      filename: SPEC,
      code: `vi.mock("./user-store");
vi.mock("./invoice-store");`,
      errors: [{ messageId: "moduleMock" }, { messageId: "moduleMock" }],
    },
  ],

  legal: [
    {
      // The distinction the rule is built on: a standalone fake replaces a value the test passes
      // in, which is a seam. A module mock replaces a neighbour behind the code's back.
      name: "a plain function double is a seam, not a module mock",
      filename: SPEC,
      code: `const loadUser = vi.fn(() => fixtureUser);`,
    },
    {
      name: "spying on a real object leaves the real module in place",
      filename: SPEC,
      code: `vi.spyOn(userStore, "load");`,
    },
    {
      name: "fake timers replace a boundary, which is the sanctioned kind of mock",
      filename: SPEC,
      code: `vi.useFakeTimers();`,
    },
    {
      name: "the fix the message asks for — the dependency passed in",
      filename: SPEC,
      code: `const service = createInvoiceService({ userStore: new InMemoryUserStore() });`,
    },
    {
      // Resolved rather than name-matched: `jest` and `vi` are both plausible local names, and a
      // rule that matched text would report on an unrelated helper.
      name: "a local binding that merely shares the framework's name",
      filename: SERVICE,
      code: `const vi = createViewIndex();
export const entry = vi.mock("billing");`,
    },
    {
      name: "a same-named method on some other object",
      filename: SERVICE,
      code: `export const stub = registry.mock("./user-store");`,
    },
    {
      name: "production code untouched by any of this",
      filename: SERVICE,
      code: `export function loadUser(store: UserStore): User { return store.load(); }`,
    },
  ],
});
