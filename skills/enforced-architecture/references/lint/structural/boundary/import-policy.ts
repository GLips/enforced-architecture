// ─── boundary/import-policy ───────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: structural check (resolution across the tree)
// Blocking:  Yes
//
// The resolved half of one policy, and the replacement for
// `boundary/cross-boundary-alias`. It walks every RELATIVE import edge in the
// tree, resolves it — which the linter cannot do — and hands it to the same
// evaluator the oxlint tier reads. Three outcomes:
//
//   internal        the edge stays inside one unit. Reported by nothing here;
//                   `placement/layer-direction` and `boundary/layer-occupancy`
//                   are what govern inside a feature.
//   deny            the semantic denial, in the same words the linter would use
//                   for the aliased spelling of the same edge.
//   allow-crossing  the edge is legal and leaves its unit, so the only finding is
//                   that it is spelled relatively.
//
// EVERY relative edge is passed, not a pre-filtered subset, and that is what
// closes the hole this check was rebuilt around. `cross-boundary-alias` selected
// on `from.boundary !== to.boundary`, and `src/shared/ui/**` and `src/shared/**`
// are one boundary — so `import { theme } from "../lib/tokens"` inside
// `src/shared/ui/` was caught by nothing at all: the shared-ui rule matched only
// `@/` specifiers, and the boundary comparison stayed quiet. Any future nested
// profile would have recreated the same hole, so the selector is gone rather than
// widened.
//
// See boundary/import-policy.md for the negative space and the adapt notes, and
// graph/import-graph.md for how an edge gets resolved at all.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// Nothing here. The policy is `lint/policy/import-policy.ts` and the shape of
// the tree is `lint/policy/layout.ts`.
//
// ──────────────────────────────────────────────────────────────────────

import { evaluateImportPolicy, renderPolicyMessage } from "../../policy/import-policy.ts";
import { classifySourcePath, classifyTargetPath } from "../../policy/layout.ts";
import type { Finding, StructuralCheck } from "../check-substrate.ts";

export const importPolicyCheck: StructuralCheck = {
  id: "boundary/import-policy",

  run({ config, importGraph }) {
    const root = config.source.roots[0];
    if (root === undefined) return [];

    const findings: Finding[] = [];
    // An unclassified file is a fact about the FILE, not about each of its
    // imports, and the linter already reports it once per file — including for a
    // file with no imports at all, which this tier cannot see. Reported here too,
    // because a check that depends on another check's completeness is the failure
    // this policy exists to remove; deduplicated, because per-edge repetition of
    // one file-level fact is noise rather than coverage.
    const unclassifiedReported = new Set<string>();

    for (const edge of importGraph()) {
      // Aliased specifiers and bare packages belong to `arch/import-policy` in the
      // linter, which sees them without resolving anything.
      if (!edge.relative) continue;

      const sourcePath = stripRoot(edge.file, root);
      if (sourcePath === undefined) continue;

      const verdict = evaluateImportPolicy({
        sourcePath,
        target: { kind: "module", path: edge.target },
        specifier: edge.specifier,
        typeOnly: edge.typeOnly,
      });

      if (verdict.kind === "internal") continue;

      if (verdict.kind === "allow-crossing") {
        const from = classifySourcePath(sourcePath);
        findings.push({
          severity: "error",
          file: edge.file,
          // Undefined for a specifier the graph could not place in the text, and
          // passed through as such. A wrong line on a blocking check sends
          // someone to the wrong place, which is worse than sending them to the
          // file.
          line: edge.line,
          message: renderPolicyMessage("crossingSpelledRelatively", {
            specifier: edge.specifier,
            fromUnit: from?.unit ?? sourcePath,
            toUnit: classifyTargetPath(edge.target)?.unit ?? edge.target,
            canonical: verdict.canonicalSpecifier,
          }),
        });
        continue;
      }

      if (verdict.messageId === "unclassifiedSource") {
        if (unclassifiedReported.has(edge.file)) continue;
        unclassifiedReported.add(edge.file);
      }

      findings.push({
        severity: "error",
        file: edge.file,
        line: edge.line,
        message: renderPolicyMessage(verdict.messageId, verdict.data),
      });
    }

    return findings;
  },
};

/** `src/features/billing/x.ts` -> `features/billing/x.ts`, or undefined if it is not under the root. */
function stripRoot(projectPath: string, root: string): string | undefined {
  return projectPath.startsWith(`${root}/`) ? projectPath.slice(root.length + 1) : undefined;
}
