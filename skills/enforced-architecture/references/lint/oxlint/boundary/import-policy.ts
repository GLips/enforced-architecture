// ─── boundary/import-policy ───────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Every forbidden import direction and every reach past a unit's
//           public surface, for the half of the import graph a linter can see:
//           aliased specifiers and bare package names.
//
// The specifier-reading half of one policy. It classifies the file it is given,
// reads every ALIASED specifier and every BARE PACKAGE in it, and hands each to
// `lint/policy/import-policy.ts`. It holds no policy of its own — no path
// regexes, no allowlists, no direction rules — and that is the point: this rule
// and the structural check below it read the same table, so the two spellings of
// one edge cannot reach different verdicts.
//
// Applies:  All src/** files EXCEPT test files and scripts.
//
// ── What this rule deliberately does not see ──────────────────────────
//
// RELATIVE SPECIFIERS. A linter cannot resolve one — where `../../beta/service`
// lands is a function of how deep the importing file sits — so they belong to
// `boundary/import-policy` in the structural tier, which has the resolved graph.
// That split needs no coordination: a package has no relative spelling and a
// relative path has no meaning without the tree, so neither adapter needs to know
// whether the other reported anything.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// Nothing here. Every knob is in `lint/policy/`: the directory names and the
// classifiers in `layout.ts`, the cells in `import-policy.ts`. If a change to
// enforcement feels like it belongs in this file, it belongs in the table
// instead — and if it does not fit the table, the table is being asked a question
// it was not built to answer.
//
// Suppression is per line and never per file: `// oxlint-disable-next-line
// arch/import-policy`. A file-level disable of a merged rule switches off every
// invariant at once, which is far broader than any single case can justify.
//
// Registration: `rules: { "import-policy": importPolicyRule }` in
// `lint/oxlint/plugin.ts`, and `"arch/import-policy": "error"` in `.oxlintrc.json`.
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { evaluateImportPolicy, POLICY_MESSAGES } from "../../policy/import-policy.ts";
import {
  classifySourcePath,
  classifySpecifier,
  sourcePathFromFilename,
} from "../../policy/layout.ts";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { isTypeOnlyDeclaration, visitModuleSources } from "../lib/module-source-visitor.ts";

export const importPolicyRule = defineRule({
  meta: {
    type: "problem",
    // Spread rather than restated, so a template added to the policy reaches this
    // rule without a second edit. `crossingSpelledRelatively` is in here and is
    // never raised by this rule: it is the structural tier's arm, and listing the
    // whole set is cheaper than a partition that can drift.
    messages: { ...POLICY_MESSAGES },
  },

  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};

    const sourcePath = sourcePathFromFilename(filename);
    if (sourcePath === undefined) return {};

    // Reported on the program rather than per import, because a file matching no
    // profile is unpoliced whether or not it imports anything — and a file with
    // no imports is precisely the one a per-import check would pass in silence.
    if (classifySourcePath(sourcePath) === undefined) {
      return {
        Program(node) {
          context.report({
            node,
            messageId: "unclassifiedSource",
            data: { path: sourcePath },
          });
        },
      };
    }

    return visitModuleSources((source, specifier) => {
      const target = classifySpecifier(specifier);
      // Undefined covers a relative path, an asset, and an alias resolving
      // outside the source root. The first belongs to the structural tier; the
      // other two are not module edges at all.
      if (target === undefined) return;

      const verdict = evaluateImportPolicy({
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
