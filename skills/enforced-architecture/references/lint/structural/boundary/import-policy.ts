// ─── boundary/import-policy ───────────────────────────────────────────
//
// Makes sure: Every relative import gets the same verdict as its aliased form,
// and every import that leaves its unit uses the alias. To find each file that
// imports a feature, you search for one string — `@/features/<name>` in the
// default vocabulary. A rule that
// matches aliased paths applies to every edge, because a relative path cannot
// avoid it.
//
// Do not match the specifier text with a pattern. An import from
// features/alpha/ui/ to a sibling feature, "../../beta/x", holds no `features/`
// segment. That is the shortest form of an import out of a unit, and thus the
// most frequent one.
//
// Pass every relative edge, with no pre-filter — not even a filter that drops an
// edge whose two ends share a boundary. A tree's shared UI directory and the
// shared directory that contains it — `shared/ui/**` and `shared/**` in the
// default vocabulary — are one boundary and two units, and unit identity is what
// makes an edge `internal`. Such a filter does not see
// `import { theme } from "../lib/tokens"` in the shared UI directory.
//
// There is no exclusion list and no per-directory scope INSIDE a tree. A path
// that you exclude leaves the whole import policy, and no message says so. The
// one scope that exists is the declared tree itself: this runs once per tree,
// over that tree's graph, and an edge leaving the tree is not in that graph —
// cross-tree coupling is real and nothing in this tier reports it.
//
// Do not drop a type-only edge. The policy reads the type mark in one row only:
// a domain's runtime imports are narrower than its type imports. A forbidden
// direction stays forbidden for a type.
//
// Coverage equals the coverage of structural/import-graph.ts. For an edge form
// that does not arrive, extend the extractor there, and do not add a match here.
//
// An `internal` edge gets no report here. placement/layer-direction reports an
// edge that goes up, and boundary/layer-occupancy reports an edge that skips an
// occupied layer.
// ──────────────────────────────────────────────────────────────────────

import { evaluateImportPolicy, renderPolicyMessage } from "../../policy/import-policy.ts";
import { classifySourcePath, classifyTargetPath } from "../../policy/layout.ts";
import type { Finding, StructuralCheck } from "../check-substrate.ts";

export const importPolicyCheck: StructuralCheck = {
  id: "boundary/import-policy",
  scope: "tree",

  async run({ vocabulary, importGraph }) {
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

      const { sourcePath } = edge;
      const verdict = evaluateImportPolicy({
        vocabulary,
        sourcePath,
        target: { kind: "module", path: edge.target },
        specifier: edge.specifier,
        typeOnly: edge.typeOnly,
      });

      if (verdict.kind === "internal") continue;

      if (verdict.kind === "allow-crossing") {
        const from = classifySourcePath(vocabulary, sourcePath);
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
            toUnit: classifyTargetPath(vocabulary, edge.target)?.unit ?? edge.target,
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

