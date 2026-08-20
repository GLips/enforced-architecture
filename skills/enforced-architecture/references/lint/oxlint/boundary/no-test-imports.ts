// ─── boundary/no-test-imports ────────────────────────────────────────
//
// Tag:      boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Production code importing from test files or test
//           infrastructure directories. While test files are exempt
//           from all boundary rules (they need cross-boundary imports
//           for setup and assertions), the REVERSE is not true:
//           production code must never depend on test utilities.
//           If production code imports test helpers, those helpers are
//           production code and should live in src/, not in test
//           infrastructure. This rule is the one boundary check that
//           applies in the opposite direction from all others.
//
// Applies:  All src/** files that are NOT themselves test files:
//           - Excludes: *.test.*, *.integration.test.*, __tests__/**
//           - Excludes: src/test/** (shared test infrastructure)
//           - Excludes: scripts
//
// Error:    "Production code cannot import from test files. If this
//            utility is needed by both tests and production, move it
//            to src/shared/ or the appropriate production directory."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. What a test module looks like from the importing side —
//    `TEST_SPECIFIER`. The default catches, in order: an extensionless
//    `./charge.test`, any `.test.` in the path, a `__tests__/`
//    directory, the `@/test/` alias, and a literal `src/test/` path.
//    Add a project's own conventions as further alternatives:
//      `__fixtures__/`, `.storybook/`, `/mocks/`.
//    Every alternative is anchored on a separator or a dot, which is
//    what keeps `@/shared/latest` and `../ui/protest` out of it.
//
// 2. Which files are governed. A file that is ITSELF a test is exempt,
//    and that judgement lives in `isArchitectureExemptPath` so this rule
//    and every other rule agree on what a test is. Extend it there, not
//    here.
//
// 3. Vitest/Jest globals: this rule targets module specifiers, not
//    global test APIs (describe, it, expect). Those are caught by the
//    test framework configuration, not by an import rule.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-test-imports": noTestImportsRule }`) and turn it on
//    in `.oxlintrc.json` (`"<plugin>/no-test-imports": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const TEST_SPECIFIER = /\.test$|\.test\.|__tests__|^@\/test\/|\/src\/test\//;

export const noTestImportsRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      testImport:
        "Production code cannot import from test files. If this utility is needed by both tests and production, move it to src/shared/ or the appropriate production directory.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!filename.includes("/src/") || isArchitectureExemptPath(filename)) return {};

    return visitModuleSources((source, specifier) => {
      if (TEST_SPECIFIER.test(specifier)) {
        context.report({ node: source, messageId: "testImport" });
      }
    });
  },
});
