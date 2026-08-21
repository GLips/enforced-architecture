// ─── testing/no-module-mocking ───────────────────────────────────────
//
// Makes sure: Every test runs the real module that it names. A change to a
// function's signature or to its behaviour fails the tests that cover it. You
// do not read each test after an edit, to find the mocks that no longer match
// the module. You can move a module to a different path without an edit to
// the tests that named the old path.
//
// This rule reports in test files. Every other rule in this catalog calls
// `isArchitectureExemptSourcePath` and skips them. A person who makes this rule match
// the others takes away its only subject, and the rule then reports nothing at
// all.
//
// It follows that this rule reads NO declared tree, and it is the only one in
// the catalog that does not. Its scope is therefore whatever oxlint hands it —
// so it is enabled in the shipped config's GLOBAL block rather than behind a
// tree glob, and a project that scopes it to a tree silently stops it reporting
// on every suite outside one, the repo-root `test/` directory included. The
// spec harness derives that placement from this file and fails the build if the
// config disagrees, in either direction.
//
// Keep all three method names in `MOCK_METHODS`. `doMock` defers the same
// replacement, and `unstable_mockModule` is the ESM spelling of it. A rule that
// matches `mock` alone leaves two ways to write the same finding.
//
// Do not add `vi.fn`, `vi.spyOn`, the fake timers or an MSW handler. Each of
// those replaces a boundary, and each is what the message asks the author to
// write instead. A rule that reports them names no edit the author can make.
//
// NEGATIVE SPACE, and it is a hole rather than a decision. `isTestFrameworkObject`
// resolves a bare Identifier, so THREE spellings of the same mock go unreported:
// a namespace import (`import * as vitest from "vitest"; vitest.mock(…)`), a
// renamed binding (`import { vi as v } from "vitest"; v.mock(…)`), and bun:test's
// `import { mock } from "bun:test"; mock.module(…)`, which is not a member call on
// a framework object at all. ea-72 tracks closing them.
//
// The first two are covered by `jest/no-restricted-jest-methods`, which was run
// head-to-head against this rule's own fixtures under ea-88 and matched all 17
// with this message text verbatim. It is not enabled, and the reason is worth
// keeping here rather than only in the config: taking it moves `MOCK_METHODS` out
// of this file and into `.oxlintrc.json`. The spec beside this rule travels into
// the adopting repo, so today an adopter who drops `unstable_mockModule` breaks a
// fixture in their own build; a config key dropped there breaks nothing anywhere,
// and no guard in this catalog can reach them. The third spelling is missed by
// both.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Scope, type SourceCode } from "@oxlint/plugins";
import { staticKeyName } from "../lib/static-key-name.ts";

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

export const noModuleMockingRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      moduleMock:
        "Module mocking couples this test to import paths rather than behaviour, and it keeps passing when the real module changes. Inject the dependency, or depend on an interface a real test implementation can satisfy.",
    },
  },
  // No `isArchitectureExemptSourcePath` call, deliberately. Module mocks live only in
  // test files, so the catalog's usual test exemption would silence this rule everywhere.
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression") return;
        if (!isTestFrameworkObject(context.sourceCode, node.callee.object)) return;
        const method = staticKeyName(node.callee.property, node.callee.computed);
        if (method !== undefined && MOCK_METHODS.has(method)) {
          context.report({ node, messageId: "moduleMock" });
        }
      },
    };
  },
});
