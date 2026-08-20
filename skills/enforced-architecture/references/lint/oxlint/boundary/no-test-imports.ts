// ─── boundary/no-test-imports ────────────────────────────────────────
//
// Makes sure: No production file under src/ imports a test module — a `.test.`
// file, a `__tests__/` directory, `@/test/` or `src/test/`. You rewrite a
// fixture or delete a helper, and only tests break. A test file is exempt from
// every other rule in this tag, and production code that imports one then
// reaches any module with no finding.
//
// A file that is ITSELF a test is exempt, and `isArchitectureExemptPath` makes
// that judgement. Extend it there. A second definition of a test file here is a
// second answer to one question.
//
// Anchor each alternative in `TEST_SPECIFIER` on a separator or a dot. A bare
// `test` alternative also matches `@/shared/latest` and `../ui/protest`.
//
// A relative path to the shared test directory, `../../test/setup`, holds
// neither `@/test/` nor `/src/test/`. This rule does not match it.
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
