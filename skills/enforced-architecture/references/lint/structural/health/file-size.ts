// ─── health/file-size ─────────────────────────────────────────────────
//
// Tag:       health
// Mechanism: structural script (counts across a file set)
// Blocking:  Mixed — warn signals "split soon", fail is a hard stop
//
// Prevents:  Files growing beyond a maintainable size. Without a mechanical
//            limit each addition is "just a few lines" until the file is 1200
//            lines and nobody wants to touch it.
//
// See health/file-size.md for why total lines rather than logical lines, and
// what the exclusion list is and is not for.
//
// ──────────────────────────────────────────────────────────────────────

import { collectFiles, readFile, toProjectPath, type Finding, type StructuralCheck } from "../lib.ts";

export const fileSizeCheck: StructuralCheck = {
  id: "health/file-size",

  run({ config }) {
    const { roots, warnThreshold, failThreshold, exclusions } = config.checks["health/file-size"];
    const findings: Finding[] = [];

    for (const root of roots) {
      for (const absolute of collectFiles(config, root, "**/*.{ts,tsx}")) {
        const file = toProjectPath(config, absolute);
        // Suffix match, so an entry works regardless of which root prefix the
        // file was found under.
        if (exclusions.some((excluded) => file.endsWith(excluded))) continue;

        const lines = lineCount(readFile(absolute));

        if (lines > failThreshold) {
          findings.push({
            severity: "error",
            file,
            message:
              `${lines} lines (limit: ${failThreshold}).\n` +
              `Split this file before committing — move a cohesive group of functions or\n` +
              `components to a sibling module in the same directory. If it genuinely cannot\n` +
              `be split yet, add it to the exclusion list in the project's architecture\n` +
              `config with a TODO naming how it gets back under the limit.`,
          });
        } else if (lines > warnThreshold) {
          findings.push({
            severity: "warning",
            file,
            message:
              `${lines} lines (warn: ${warnThreshold}, limit: ${failThreshold}).\n` +
              `Approaching the hard limit — consider splitting proactively. Extract helper\n` +
              `functions to a sibling module, split a large component into subcomponents,\n` +
              `or move substantial type definitions to a dedicated types file.`,
          });
        }
      }
    }

    return findings;
  },
};

function lineCount(content: string): number {
  if (content.length === 0) return 0;
  const lines = content.split("\n").length;
  // A trailing newline should not count as an extra empty line.
  return content.endsWith("\n") ? lines - 1 : lines;
}
