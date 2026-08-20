// ─── boundary/no-test-imports ────────────────────────────────────────
//
// Makes sure: No production file under src/ imports a test module — a `.test.`
// file, a `__tests__/` directory, `@/test/` or `src/test/`. You rewrite a
// fixture or delete a helper, and only tests break. A test file is exempt from
// every other rule in this tag, and production code that imports one then
// reaches any module with no finding.
//
// A file that is ITSELF a test is exempt, and `isArchitectureExemptSourcePath` makes
// that judgement. Extend it there. A second definition of a test file here is a
// second answer to one question.
//
// `namesTestModule` compares whole segments and a whole suffix, never a
// substring: a bare `test` match also claims `@/shared/latest` and
// `../ui/protest`, and `.test.` anywhere claims `foo.test.helpers`, which is
// production code the exemption predicate governs.
//
// A relative path to the shared test directory, `../../test/setup`, resolves to
// no path this rule can read — a linter cannot resolve a relative specifier —
// so this rule does not match it. boundary/import-policy in the structural tier
// is the tier that sees those.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { namesTestModule } from "../../policy/declared-trees.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

export const noTestImportsRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      testImport:
        "Production code cannot import from test files. If this utility is needed by both tests and production, move it to src/shared/ or the appropriate production directory.",
    },
  },
  create(context, role) {
    const { aliasPrefix } = role.tree.vocabulary;

    return visitModuleSources((source, specifier) => {
      // The alias prefix is stripped so an aliased specifier and a source-root
      // path are one string, which is what lets `namesTestModule` own the
      // convention for both this rule and the exemption every other rule reads.
      const path = specifier.startsWith(aliasPrefix)
        ? specifier.slice(aliasPrefix.length)
        : specifier;
      if (namesTestModule(path)) {
        context.report({ node: source, messageId: "testImport" });
      }
    });
  },
});
