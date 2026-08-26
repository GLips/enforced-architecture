// The fixture tree's `arch.config.ts`, and its declared-tree list.
//
// It is also the worked example of item 3 of the tier's contract: adopting these
// checks in a new codebase is writing a file like this one, not editing a
// constant inside a check body. Everything the tree needs that differs from the
// catalog defaults is visible here, as a whole value replacing a whole value.
//
// Three things are worth reading before the rest:
//
//   - `health/file-size` scans a SECOND root, `packages/core/src`. It is one of
//     the two project-scoped checks, so its roots are its own and are NOT
//     declared trees — file size is a question about a file a human maintains.
//     A check pointed at a root that does not exist returns cleanly by design,
//     so an unexercised root is indistinguishable from a working one; the tree
//     carries a generated fixture in that root for exactly that reason.
//   - `style/token-equality` READS its scales out of the tree's own theme module
//     rather than restating them or importing it. That seam is the whole reason
//     the rule is a script — an enforcer that reads the scale cannot drift from
//     it — and reading beats importing because a compile-time token module has
//     no runtime to import at all. See `structural/theme-scale.ts`.
//   - the tree list below is TWO lists, and the difference between them is the
//     whole of what declaring a tree buys. `run-structural-fixtures.ts` runs the
//     suite under `DECLARED_FIXTURE_TREES` and probes the second list; see the
//     probe there.

import { resolve } from "node:path";
import {
  declareTrees,
  type DeclaredTree,
  type ValidatedTrees,
} from "../../skills/enforced-architecture/references/lint/policy/declared-trees.ts";
import {
  RECOMMENDED_VOCABULARY,
  type TreeVocabulary,
} from "../../skills/enforced-architecture/references/lint/policy/layout.ts";
import {
  type ArchitectureConfig,
  defaultCheckConfigs,
} from "../../skills/enforced-architecture/references/lint/structural/config.ts";
import { readThemeScaleFromSource } from "../../skills/enforced-architecture/references/lint/structural/theme-scale.ts";

export const FIXTURE_TREE = resolve(import.meta.dirname, "tree");

const FIXTURE_THEME_MODULE = resolve(FIXTURE_TREE, "src/shared/ui/theme.ts");

/** The tree every fixture in `tree/src` belongs to. */
export const APP_TREE: DeclaredTree = { root: "src", vocabulary: RECOMMENDED_VOCABULARY, tsconfig: "tsconfig.json" };

/**
 * A second tree that renames one directory, which is the whole of what a
 * fork-free config may vary. Nothing about it is declared by default: the files
 * under `tree/packages/pdf/src` are the undeclared-sibling half of the probe,
 * and the rename is what proves a declared tree is read with ITS OWN vocabulary
 * rather than the first tree's — `capabilities/` is a feature directory here and
 * a topology violation under the app tree's spelling.
 */
export const PDF_VOCABULARY: TreeVocabulary = {
  ...RECOMMENDED_VOCABULARY,
  featuresDir: "capabilities",
};

export const PDF_TREE: DeclaredTree = { root: "packages/pdf/src", vocabulary: PDF_VOCABULARY, tsconfig: "tsconfig.json" };

/** What the suite runs against: one tree, exactly as a single-app project declares. */
export const DECLARED_FIXTURE_TREES: ValidatedTrees = declareTrees([APP_TREE]);

/** The same project after it adopts the catalog for its second package. */
export const BOTH_FIXTURE_TREES: ValidatedTrees = declareTrees([APP_TREE, PDF_TREE]);

/**
 * The POSITIVE CONTROL for the vocabulary half of the probe: the same second
 * root, declared with the WRONG vocabulary.
 *
 * Without this list the vocabulary assertion is one-sided — "no finding under
 * `capabilities/`" — and a one-sided negative passes just as well when the
 * fixture it is meant to read is renamed, moved, or deleted, with nothing else
 * in the suite reading that fixture to say so. This list makes the fixture's
 * presence load-bearing: read with the app tree's spelling, `capabilities/` is a
 * top-level directory no grammar claims and topology must report it.
 */
export const PDF_TREE_MISREAD: ValidatedTrees = declareTrees([
  APP_TREE,
  { root: PDF_TREE.root, vocabulary: RECOMMENDED_VOCABULARY, tsconfig: PDF_TREE.tsconfig },
]);

/**
 * The POSITIVE CONTROL for `assertTreeIsTypeChecked`: the app tree declared
 * against a tsconfig that compiles a different package.
 *
 * The same argument as `PDF_TREE_MISREAD`, one module over. Every `types/`
 * expectation already goes red when the program is empty — but it goes red
 * because this tree HAS fixtures, and an adopting project in the same state has
 * none, so it gets zero findings and a green run. This list is what makes the
 * guard itself load-bearing: `tsconfig.type-unchecked.json` is a working config
 * that simply does not contain `src`, and declaring it has to CRASH the types
 * checks rather than quiet them.
 */
export const APP_TREE_TYPE_UNCHECKED: ValidatedTrees = declareTrees([
  { ...APP_TREE, tsconfig: "tsconfig.type-unchecked.json" },
]);

/**
 * The app tree declared against a SOLUTION-STYLE root: `files: []` plus a
 * reference to the config that really does compile `src`.
 *
 * The declaration an adopter actually writes when they hit this — the file is
 * CALLED `tsconfig.json` and it is valid — so the guard's wrong-program branch
 * has to refuse it by name and prescribe the referenced config, not "widen the
 * include" of a file whose include is correctly empty. The assertion in
 * `run-structural-fixtures.ts` pins that message, and the message is the whole
 * point: the crash alone is indistinguishable from the partial-miss one.
 */
export const APP_TREE_SOLUTION_TSCONFIG: ValidatedTrees = declareTrees([
  { ...APP_TREE, tsconfig: "tsconfig.solution.json" },
]);

/**
 * The app tree declared against a config that compiles it MINUS one directory —
 * the other of the guard's two failure shapes. It needs a control of its own
 * because the wrong-program lists above produce the other message, so nothing
 * else pins the partial-miss one.
 */
export const APP_TREE_TYPE_PARTIAL: ValidatedTrees = declareTrees([
  { ...APP_TREE, tsconfig: "tsconfig.type-partial.json" },
]);

export const fixtureConfig: ArchitectureConfig = {
  projectRoot: FIXTURE_TREE,
  checks: {
    ...defaultCheckConfigs,

    "health/file-size": {
      ...defaultCheckConfigs["health/file-size"],
      roots: ["src", "packages/core/src"],
    },

    "style/token-equality": {
      ...defaultCheckConfigs["style/token-equality"],
      spacingScale: readThemeScaleFromSource({ path: FIXTURE_THEME_MODULE, exportName: "spacing" }),
      radiusScale: readThemeScaleFromSource({ path: FIXTURE_THEME_MODULE, exportName: "radius" }),
    },
  },
};
