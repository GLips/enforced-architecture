// ─── boundary/no-test-imports ────────────────────────────────────────
//
// Makes sure: No production file in a declared tree imports a test module — a
// `.test` module, a `__tests__/` directory anywhere, or the cross-cutting
// `test/` directory at the tree's source root, `@/test/` under the default
// alias prefix. Only that prefix is vocabulary: `.test`, `test/` and
// `__tests__/` are naming facts this catalog fixes for every tree, so a project
// that spells its test root `tests/` is changing the catalog, not its own
// names. You rewrite a fixture or delete a helper, and only tests break. A test
// file is exempt from every other rule in this tag, and production code that
// imports one then reaches any module with no finding.
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
import { aliasSpecifierFor, type TreeVocabulary } from "../../policy/layout.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

/**
 * Where the message sends a utility that both tests and production need, in the
 * REPORTING tree's names.
 *
 * Spelled as a specifier rather than as a directory on disk, because the
 * reader's next act is to write an import of it — and the alias is the one
 * spelling that does not need the tree's root to resolve.
 *
 * Exported for its spec, and that is load-bearing rather than convenience.
 * `DECLARED_TREES` holds one tree, spelled exactly as `RECOMMENDED_VOCABULARY`
 * spells it, so a message frozen back to a literal `@/shared/` renders the same
 * text every fixture beside it asserts. Rendering under a SECOND vocabulary is
 * the only assertion that separates deriving from having been written down
 * correctly once, and a rule spec has no way to declare a second tree.
 */
export function testImportMessageData(vocabulary: TreeVocabulary): { shared: string } {
  return { shared: aliasSpecifierFor(vocabulary, vocabulary.sharedDir) };
}

export const noTestImportsRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      testImport:
        "Production code cannot import from test files. If this utility is needed by both tests and production, move it to {{shared}}/ or the appropriate production directory.",
    },
  },
  create(context, role) {
    const { vocabulary } = role.tree;
    const { aliasPrefix } = vocabulary;
    const data = testImportMessageData(vocabulary);

    return visitModuleSources((source, specifier) => {
      // The alias prefix is stripped so an aliased specifier and a source-root
      // path are one string, which is what lets `namesTestModule` own the
      // convention for both this rule and the exemption every other rule reads.
      const path = specifier.startsWith(aliasPrefix)
        ? specifier.slice(aliasPrefix.length)
        : specifier;
      if (namesTestModule(path)) {
        context.report({ node: source, messageId: "testImport", data });
      }
    });
  },
});
