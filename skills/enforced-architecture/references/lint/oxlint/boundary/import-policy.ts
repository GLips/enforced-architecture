// ─── boundary/import-policy ───────────────────────────────────────────
//
// Makes sure: One table decides every aliased specifier and every bare package
// name inside a declared tree. A feature and a domain are reached at their barrel, so you
// move a file inside one and no file outside it changes. `@/env.server` reaches
// no client file, and a domain takes no runtime package.
//
// This rule holds no policy of its own — no path regexes, no allowlists, no
// direction rules. It classifies the file and hands each specifier to
// lint/policy/import-policy.ts, which the structural tier reads too. A change to
// enforcement belongs in that table; a change that does not fit the table is a
// question the table was not built to answer.
//
// RELATIVE SPECIFIERS are not visible here. A linter cannot resolve one — where
// `../../beta/service` lands depends on the depth of the file that names it — so
// they belong to boundary/import-policy in the structural tier. Neither adapter
// needs to know what the other reported: a package has no relative spelling, and
// a relative path has no meaning without the tree.
//
// Suppress per line and never per file: `// oxlint-disable-next-line
// arch/import-policy`. A file-level disable of a merged rule removes every
// invariant at once, which no single case justifies.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import {
  describeKnownAreas,
  evaluateImportPolicy,
  POLICY_MESSAGES,
} from "../../policy/import-policy.ts";
import { classifySpecifier } from "../../policy/layout.ts";
import { isTypeOnlyDeclaration, visitModuleSources } from "../lib/module-source-visitor.ts";

export const importPolicyRule = defineTreeRule({
  meta: {
    type: "problem",
    // Spread rather than restated, so a template added to the policy reaches this
    // rule without a second edit. `crossingSpelledRelatively` is in here and is
    // never raised by this rule: it is the structural tier's arm, and listing the
    // whole set is cheaper than a partition that can drift.
    messages: { ...POLICY_MESSAGES },
  },

  create(context, role) {
    // Outside every declared tree this rule is silent, `unclassifiedSource`
    // included — which is the whole point of the declaration. This is the one
    // rule whose no-match answer is a BLOCKING error rather than nothing, so
    // widening its reach past the declared trees is uniquely expensive: a
    // correct package with its own layout draws that error on 100% of its
    // files, imports or not, and the only way to clear it is to stop using the
    // linter.

    const { vocabulary } = role.tree;
    const { sourcePath } = role;

    // Reported on the program rather than per import, because a file matching no
    // profile is unpoliced whether or not it imports anything — and a file with
    // no imports is precisely the one a per-import check would pass in silence.
    // Loud INSIDE a declared tree and silent outside every one of them: an area
    // nobody decided is a hole, and a package nobody adopted is not.
    if (role.place === undefined) {
      return {
        Program(node) {
          context.report({
            node,
            messageId: "unclassifiedSource",
            data: { path: sourcePath, areas: describeKnownAreas(vocabulary) },
          });
        },
      };
    }

    return visitModuleSources((source, specifier) => {
      const target = classifySpecifier(vocabulary, specifier);
      // Undefined covers a relative path, an asset, and an alias resolving
      // outside the source root. The first belongs to the structural tier; the
      // other two are not module edges at all.
      if (target === undefined) return;

      const verdict = evaluateImportPolicy({
        vocabulary,
        sourcePath,
        target,
        specifier,
        typeOnly: isTypeOnlyDeclaration(source.parent),
      });

      // `allow-crossing` is the structural tier's to report: the edge is
      // permitted, and a specifier this rule can read is already spelled the
      // canonical way or is a package with no other spelling.
      if (verdict.kind !== "deny") return;

      context.report({ node: source, messageId: verdict.messageId, data: verdict.data });
    });
  },
});
