// ─── naming/test-file-mirror ──────────────────────────────────────────
//
// Shows: The tests that a search for their source module does not find. A test
// that carries the name of its source comes back in that same search. Then you
// see the test that constrains a module before you change the module. This
// check only warns, thus the project can keep a test name that no search
// connects to its source.
//
// This is the one check whose subject is a file that every other check skips,
// thus it is the one caller of `collectFiles` with `includeExcluded`. A person
// who makes this walk the same as the other walks deletes that option. The
// check then reads no test files and stays green.
//
// The check never asks if a source file has a test. Tests must earn their
// place, and many modules correctly have none. A rule that demands a test here
// makes people add test files with no assertions.
//
// `base` comes from `absolute`, not from `sourcePath`, although every line
// around it uses `sourcePath`. `existsSync` on a source-root-relative path
// tests the current directory, and then each mirrored test becomes an orphan
// report.
// ──────────────────────────────────────────────────────────────────────

import { existsSync } from "node:fs";
import { basename } from "node:path";
import {
  collectFiles,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

/**
 * Extensions a test's sibling source may carry. `.tsx` is not decoration: a
 * lookup for `<base>.ts` alone reports every component test in the project as an
 * orphan, and that flood is what gets a warning-level check switched off.
 */
const SIBLING_SOURCE_EXTENSIONS = [".ts", ".tsx"];

export const testFileMirrorCheck: StructuralCheck = {
  id: "naming/test-file-mirror",

  run({ config }) {
    const { testSuffixes, nonconforming, orphanAllowedDirs } =
      config.checks["naming/test-file-mirror"];
    const findings: Finding[] = [];

    for (const absolute of collectFiles(config, "", "**/*.{ts,tsx,js,jsx}", {
      fromSourceRoot: true,
      includeExcluded: true,
    })) {
      const sourcePath = toSourcePath(config, absolute);
      const file = toProjectPath(config, absolute);

      // Off-convention names are answered first because a `.spec.` file
      // typically DOES sit beside its source: the orphan branch below has
      // nothing to say about it, and asking it first would let the file pass.
      if (nonconforming.some((pattern) => pattern.test(sourcePath))) {
        findings.push({
          severity: "warning",
          file,
          message:
            `Off-convention test name — this project's suffixes are ${testSuffixes.join(", ")}.\n` +
            `Spelled this way the test does not surface in a search for the module it\n` +
            `covers. Rename it to that module's name plus the suffix, so the code and the\n` +
            `test that constrains it are one search apart.`,
        });
        continue;
      }

      const suffix = longestTestSuffix(sourcePath, testSuffixes);
      if (suffix === undefined) continue;
      if (orphanAllowedDirs.some((dir) => sourcePath.startsWith(`${dir}/`))) continue;

      const base = absolute.slice(0, -suffix.length);
      if (SIBLING_SOURCE_EXTENSIONS.some((extension) => existsSync(base + extension))) continue;

      const name = basename(base);
      findings.push({
        severity: "warning",
        file,
        message:
          `No ${name}.ts or ${name}.tsx sits beside this test, so a search for the code it\n` +
          `covers never turns it up. Rename the test after the module it exercises. If it\n` +
          `is a cross-cutting suite that maps to no single module, add its directory to\n` +
          `orphanAllowedDirs in the project's architecture config.`,
      });
    }

    return findings;
  },
};

/**
 * The longest suffix the path ends with, because the suffixes nest:
 * `.integration.test.ts` also ends with `.test.ts`. Taking the shorter match
 * leaves `imports.integration.test.ts` hunting for a source called
 * `imports.integration`, and reports a correctly mirrored test as an orphan —
 * a false positive on the convention the check is trying to teach.
 */
function longestTestSuffix(path: string, suffixes: string[]): string | undefined {
  let longest: string | undefined;
  for (const suffix of suffixes) {
    if (!path.endsWith(suffix)) continue;
    if (longest === undefined || suffix.length > longest.length) longest = suffix;
  }
  return longest;
}
