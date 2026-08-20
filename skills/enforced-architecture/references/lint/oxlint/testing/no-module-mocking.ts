// ─── testing/no-module-mocking ───────────────────────────────────────
//
// Tag:      testing
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Module-level mocking — `vi.mock`, `vi.doMock`, `jest.mock`,
//           `jest.unstable_mockModule`.
//
//             vi.mock("./user-store");
//
//           A module mock replaces a dependency by its PATH, which
//           means the test is coupled to how the code under test
//           imports things rather than to what it does. Move the import
//           and the test breaks while the behaviour is unchanged.
//           Change the real module's behaviour and the test keeps
//           passing against a fake that no longer resembles it — the
//           failure that matters, because it is silent.
//
//           The alternative is a seam: pass the dependency in, or
//           depend on an interface the test can satisfy with a real
//           implementation. That forces the design question a module
//           mock lets you skip — which is usually why the mock was
//           reached for.
//
//           This is the rule most likely to be argued with, and the
//           argument is legitimate. It is here because module mocking
//           is what an agent reaches for when a test is hard to write,
//           and "this test is hard to write" is information about the
//           design that the mock deletes.
//
// Excludes: Everything else the test framework offers — `vi.fn()`,
//           `vi.spyOn`, fake timers, and MSW-style network interception
//           are all untouched. Those replace a boundary; a module mock
//           replaces a neighbour.
//
// Applies:  ALL files, including test files. This rule is the reason
//           the tag exists — exempting tests would exempt everything.
//
// Error:    "Module mocking couples this test to import paths rather
//            than behaviour, and it keeps passing when the real module
//            changes. Inject the dependency, or depend on an interface
//            a real test implementation can satisfy."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Note the inverted file scope:
//    Every other oxlint rule in this catalog calls
//    `isArchitectureExemptPath` and skips test files. This one MUST
//    NOT — module mocks only appear in tests, so the usual exemption
//    would make the rule a no-op. That is easy to "fix" by accident
//    while tidying; the spec's test-file cases are what catch it.
//
// 2. Which frameworks — `MOCK_METHODS` and `TEST_GLOBALS`:
//    Vitest's `vi` and Jest's `jest` are covered, resolved as bindings
//    so an import alias does not evade the rule. Add a framework by
//    extending both sets.
//
// 3. Migrating an existing suite:
//    Turning this on in a codebase with hundreds of module mocks is not
//    a lint change, it is a refactor. Run it as a warning first and
//    treat the count as a design backlog, or scope it by path to new
//    directories only. A blocking rule nobody can satisfy gets disabled
//    wholesale, which costs more than never adding it.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-module-mocking": noModuleMockingRule }`) and turn
//    it on in `.oxlintrc.json`
//    (`"<plugin>/no-module-mocking": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Scope, type SourceCode } from "@oxlint/plugins";

const MOCK_METHODS = new Set(["doMock", "mock", "unstable_mockModule"]);

const TEST_GLOBALS = new Map([
  ["vi", "vitest"],
  ["jest", "@jest/globals"],
]);

function importedBindingSource(variable: { defs: readonly { type: string; node: ESTree.Node; parent?: ESTree.Node | null }[] }): string | null {
  for (const definition of variable.defs) {
    if (definition.type === "ImportBinding" && definition.parent?.type === "ImportDeclaration") {
      return String(definition.parent.source.value);
    }
  }
  return null;
}

// Resolved rather than name-matched, so `import { vi } from "vitest"` and a bare global `vi` both
// report, while a local `const vi = makeHelper()` does not. A test framework object is genuinely
// ambiguous by name alone — `jest` is also a plausible variable name.
function isTestFrameworkObject(sourceCode: SourceCode, node: ESTree.Expression): boolean {
  if (node.type !== "Identifier") return false;
  const expectedSource = TEST_GLOBALS.get(node.name);
  if (expectedSource === undefined) return false;

  let scope: Scope | null = sourceCode.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(node.name);
    if (variable !== undefined) {
      // Bound locally: it counts only when the binding came from the framework's own module.
      return importedBindingSource(variable) === expectedSource;
    }
    scope = scope.upper;
  }
  // Unbound: the framework's injected global, which is how both runners expose it by default.
  return true;
}

function accessedMethodName(callee: ESTree.MemberExpression): string | null {
  if (callee.computed) {
    return callee.property.type === "Literal" && typeof callee.property.value === "string"
      ? callee.property.value
      : null;
  }
  return callee.property.type === "Identifier" ? callee.property.name : null;
}

export const noModuleMockingRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      moduleMock:
        "Module mocking couples this test to import paths rather than behaviour, and it keeps passing when the real module changes. Inject the dependency, or depend on an interface a real test implementation can satisfy.",
    },
  },
  // No `isArchitectureExemptPath` call, deliberately — see Adapt note 1. Module mocks live only in
  // test files, so the catalog's usual test exemption would silence this rule everywhere.
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression") return;
        if (!isTestFrameworkObject(context.sourceCode, node.callee.object)) return;
        const method = accessedMethodName(node.callee);
        if (method !== null && MOCK_METHODS.has(method)) {
          context.report({ node, messageId: "moduleMock" });
        }
      },
    };
  },
});
