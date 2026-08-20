// ─── naming/test-file-mirror ──────────────────────────────────────────
//
// Shows: The tests that a search for their source module does not find. A test
// that carries the name of its source comes back in that same search. Then you
// see the test that constrains a module before you change the module. This
// check only warns, thus the project can keep a test name that no search
// connects to its source.
//
// This is the one check whose subject is a file that every other check skips,
// thus it is the one caller of `collectTreeFiles` with `includeExempt`. A person
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
import { SOURCE_EXTENSIONS, SOURCE_FILE_GLOB, withoutSourceExtension } from "../../policy/layout.ts";
import {
  collectTreeFiles,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

/**
 * The two spellings a test carries when it is NOT named after its module —
 * matched against the path with its extension already stripped.
 *
 * Not configuration. `testSuffixes` is vocabulary, because which suffix a
 * project blesses is a name it chooses; "a `.spec` file is off-convention" is
 * the check's own claim about every project, and handing it over as a regex list
 * hands over the check. An adopter who writes `.spec` sets `testSuffixes` to
 * `[".spec"]` and this list stops applying to them, because a blessed suffix is
 * matched before it — see the ordering in `run`.
 */
const OFF_CONVENTION_TEST_SPELLINGS = [/\.spec$/, /(^|\/)test_[^/]+$/];

export const testFileMirrorCheck: StructuralCheck = {
  id: "naming/test-file-mirror",
  scope: "tree",

  run(context) {
    const { config } = context;
    const { testSuffixes, orphanAllowedDirs } = config.checks["naming/test-file-mirror"];
    const findings: Finding[] = [];

    for (const absolute of collectTreeFiles(context, SOURCE_FILE_GLOB, { includeExempt: true })) {
      const sourcePath = toSourcePath(context, absolute);
      const file = toProjectPath(config, absolute);
      // Extension gone before either branch reads the name. Which extension a
      // test carries says nothing about whether it is spelled on-convention, and
      // a pattern that names extensions governs the ones it lists.
      const bareSourcePath = withoutSourceExtension(sourcePath);

      // The blessed suffixes are asked FIRST, and that ordering is the whole
      // reason a project may bless `.spec`: the off-convention list below is
      // fixed, so a project whose convention IS `.spec` would otherwise be told
      // its every test is misnamed by a list it cannot edit.
      const suffix = longestTestSuffix(bareSourcePath, testSuffixes);

      // An off-convention name typically DOES sit beside its source, so the
      // orphan branch has nothing to say about it. Reporting it here is the only
      // thing that steers the file toward the name a search would find.
      if (suffix === undefined) {
        if (OFF_CONVENTION_TEST_SPELLINGS.some((pattern) => pattern.test(bareSourcePath))) {
          findings.push({
            severity: "warning",
            file,
            message:
              `Off-convention test name — this project's suffixes are ${testSuffixes.join(", ")}.\n` +
              `Spelled this way the test does not surface in a search for the module it\n` +
              `covers. Rename it to that module's name plus the suffix, so the code and the\n` +
              `test that constrains it are one search apart.`,
          });
        }
        continue;
      }

      if (orphanAllowedDirs.some((dir) => sourcePath.startsWith(`${dir}/`))) continue;

      const bare = withoutSourceExtension(absolute);
      const base = bare.slice(0, -suffix.length);
      // The sibling may be written in ANY source extension, not just this test's
      // — a `.test.ts` beside a `.mts` module is an ordinary pairing.
      if (SOURCE_EXTENSIONS.some((extension) => existsSync(`${base}.${extension}`))) continue;

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
