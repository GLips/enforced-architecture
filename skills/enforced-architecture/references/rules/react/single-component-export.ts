// ─── react/single-component-export ────────────────────────────────────
//
// Tag:       react
// Mechanism: structural script (counts across a file set)
// Blocking:  No — warning only
//
// Prevents:  Two exported components in one file. Both are then found by the
//            name of the FILE rather than their own, so the second is invisible
//            to a grep for where it is defined.
//
// The declaration forms this has to see live in `scripts/component-declarations.ts`,
// shared with `react/hook-count` and `react/prop-count`. See
// react/single-component-export.md for why the classifier tests the bound value
// rather than the exported name, and why the compound exemption exists.
//
// ──────────────────────────────────────────────────────────────────────

import { findComponentDeclarations } from "../scripts/component-declarations.ts";
import {
  blankComments,
  collectFiles,
  readFile,
  stripCommentsAndStrings,
  toProjectPath,
  type Finding,
  type StructuralCheck,
} from "../scripts/lib.ts";

/**
 * A compound component namespaced under one export is the sanctioned shape, and
 * it is what this check's own message recommends — so the exemption has to hold
 * or the rule tells people to do something that fails.
 */
const COMPOUND_NAMESPACE = /\bObject\.assign\s*\(/;

export const singleComponentExportCheck: StructuralCheck = {
  id: "react/single-component-export",

  run({ config }) {
    const { targetDirs } = config.checks["react/single-component-export"];
    const findings: Finding[] = [];

    for (const dir of targetDirs) {
      for (const absolute of collectFiles(config, dir, "**/*.tsx", { fromSourceRoot: true })) {
        // Barrels re-export by design: every name in one is defined elsewhere.
        if (absolute.endsWith("/index.tsx")) continue;

        // Block comments go first so a component name in prose cannot be
        // counted; the per-line pass then empties strings, which is what the
        // classifier's paren walk needs.
        const source = blankComments(readFile(absolute));
        if (COMPOUND_NAMESPACE.test(source)) continue;

        const exported = findComponentDeclarations(source.split("\n").map(stripCommentsAndStrings));
        if (exported.length < 2) continue;

        findings.push({
          severity: "warning",
          file: toProjectPath(config, absolute),
          // The extra component is the one a reader acts on, not the first.
          line: exported[1]?.line,
          message:
            `exports ${exported.map((component) => component.name).join(", ")}.\n` +
            `Each is found by the name of this file rather than its own, so all but the\n` +
            `first are invisible to a grep for where they are defined. Give each its own\n` +
            `file, or namespace them under one export with Object.assign if they are\n` +
            `genuinely a compound component.`,
        });
      }
    }

    return findings;
  },
};
