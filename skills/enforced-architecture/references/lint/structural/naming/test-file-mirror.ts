// ─── naming/test-file-mirror ──────────────────────────────────────────
//
// Shows: The tests that a search for their source module does not find. A test
// that carries the name of its source comes back in that same search. Then you
// see the test that constrains a module before you change the module. This
// check only warns, thus the project can keep a test name that no search
// connects to its source.
//
// This is the one check whose subject is a file that every other check skips,
// thus it is the one caller of `collectTreeFiles` with `includeTests`. A person
// who makes this walk the same as the other walks deletes that option. The
// check then reads no test files and stays green.
//
// That option waives the TEST exemption and no other. A generated directory, an
// ambient declaration and a script stay invisible here, because a test inside
// one of them is still a file nobody wrote — a rename this check asks for is an
// edit to a generator's output that the next run undoes.
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
  hasTestDirectorySegment,
  TEST_MODULE_SUFFIX,
} from "../../policy/declared-trees.ts";
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
 * Not configuration, in either direction. "A `.spec` file is off-convention" is
 * this check's claim about every project, and as a regex list it was the check
 * itself handed to the adopter — one `[]` and the branch reports nothing. The
 * blessed spelling it steers toward is `TEST_MODULE_SUFFIX`, which the whole
 * catalog reads, so this branch and the exemption every other rule inherits
 * cannot disagree about what a test is.
 */
const OFF_CONVENTION_TEST_SPELLINGS = [/\.spec$/, /(^|\/)test_[^/]+$/];

export const testFileMirrorCheck: StructuralCheck = {
  id: "naming/test-file-mirror",
  scope: "tree",

  run(context) {
    const { config } = context;
    const findings: Finding[] = [];

    for (const absolute of collectTreeFiles(context, SOURCE_FILE_GLOB, { includeTests: true })) {
      const sourcePath = toSourcePath(context, absolute);
      const file = toProjectPath(config, absolute);
      // Extension gone before either branch reads the name. Which extension a
      // test carries says nothing about whether it is spelled on-convention, and
      // a pattern that names extensions governs the ones it lists.
      const bareSourcePath = withoutSourceExtension(sourcePath);

      // The blessed suffix is asked FIRST: a name carrying it is on-convention
      // whatever else it contains, and only a name that does NOT carry it can be
      // an off-convention spelling of the same thing.
      if (!bareSourcePath.endsWith(TEST_MODULE_SUFFIX)) {
        // An off-convention name typically DOES sit beside its source, so the
        // orphan branch has nothing to say about it. Reporting it here is the
        // only thing that steers the file toward the name a search would find.
        if (OFF_CONVENTION_TEST_SPELLINGS.some((pattern) => pattern.test(bareSourcePath))) {
          findings.push({
            severity: "warning",
            file,
            message:
              `Off-convention test name — this project's test suffix is ${TEST_MODULE_SUFFIX}.\n` +
              `Spelled this way the test does not surface in a search for the module it\n` +
              `covers. Rename it to that module's name plus the suffix, so the code and the\n` +
              `test that constrains it are one search apart.`,
          });
        }
        continue;
      }

      // A cross-cutting suite maps to no single module by design, and where such
      // a suite lives is already a fact this catalog reads everywhere else.
      if (hasTestDirectorySegment(sourcePath)) continue;

      const bare = withoutSourceExtension(absolute);
      const base = bare.slice(0, -TEST_MODULE_SUFFIX.length);
      if (hasSiblingModule(base)) continue;
      // `imports.integration.test.ts` covers `imports.ts`: one QUALIFIER before
      // the suffix is part of the convention, not part of the module name. A
      // configured list of compound suffixes said the same thing in a form an
      // adopter could extend until every orphan was spelled legal.
      //
      // The dot has to be in the FILENAME. `base` is an absolute path, so a
      // directory called `app.v2` supplies a dot of its own — and stripping that
      // one hunts for a module named after half an ancestor directory, which
      // exists nowhere, so the report lands on a correctly named test.
      const lastDot = base.lastIndexOf(".");
      const qualified = base.slice(0, lastDot);
      if (lastDot > base.lastIndexOf("/") && hasSiblingModule(qualified)) continue;

      const name = basename(base);
      findings.push({
        severity: "warning",
        file,
        message:
          `No ${name} module sits beside this test, so a search for the code it covers\n` +
          `never turns it up. Rename the test after the module it exercises. If it is a\n` +
          `cross-cutting suite that maps to no single module, move it to a test directory\n` +
          `— \`test/\` at the top of the tree, or a \`__tests__/\` beside the code — which is\n` +
          `where this check and every other rule already expect one to live.`,
      });
    }

    return findings;
  },
};

/**
 * True when a module of this base name sits beside the test, in ANY source
 * extension — a `.test.ts` beside a `.mts` module is an ordinary pairing.
 *
 * `base` is ABSOLUTE, not source-root-relative: `existsSync` on a relative path
 * tests the current working directory, and every mirrored test then reads as an
 * orphan.
 */
function hasSiblingModule(base: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) => existsSync(`${base}.${extension}`));
}
