// ─── health/file-size ─────────────────────────────────────────────────
//
// Makes sure: Every source file in the configured roots is shorter than
// failThreshold lines. You can read a complete file before you change one
// function in it. No file grows so large that you must plan the split as
// separate work.
//
// Count every line: code, comments and blank lines. Do not add a parser that
// skips imports, type declarations or comments. A file with 300 lines of code
// and 300 lines of comments is still 600 lines for a person to read. A count
// of logical lines selects almost the same files.
//
// Keep two thresholds and two severities. The gap between them lets a person
// finish a change and split the file in the same commit. One threshold stops
// the work in the middle of the change. If the hard limit reports a warning,
// an agent continues past it and the file keeps its size.
//
// There is no per-file pragma. A comment in the file puts the exemption in the
// file that grew, where nobody reads it again. The exclusion list is central,
// thus every exemption is in one place and each new one is visible in the
// config diff.
//
// Do not make an exclusion match a directory. A directory that produces large
// files again and again is the result you want to see.
// ──────────────────────────────────────────────────────────────────────

import { SOURCE_FILE_GLOB } from "../../policy/layout.ts";
import {
  collectProjectFiles,
  readFile,
  toProjectPath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

export const fileSizeCheck: StructuralCheck = {
  id: "health/file-size",
  // Project-scoped, and the only file-walking check that is. Size is a question
  // about a file a human maintains, not about a position in an architecture, so
  // its roots are the config's own list and may name a tree this catalog governs
  // nothing else in.
  scope: "project",

  run({ config }) {
    const { roots, warnThreshold, failThreshold } = config.checks["health/file-size"];
    const findings: Finding[] = [];

    for (const root of roots) {
      for (const absolute of collectProjectFiles(config, root, SOURCE_FILE_GLOB)) {
        const file = toProjectPath(config, absolute);

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
