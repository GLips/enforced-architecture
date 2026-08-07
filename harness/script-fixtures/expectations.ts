// The three-kind contract for the structural-script tier.
//
// The oxlint tier gets this from `describeRule`, which takes the kinds as named
// arguments so a missing one is a type error rather than a convention nobody
// checks. This is the same contract against a shared fixture tree, and it is a
// declaration rather than inline code for one reason: these checks scan declared
// roots rather than being handed a file, so their cases have to be real files on
// disk and the expectation has to name them.

export type FixtureFinding = string;

/**
 * A generated fixture: `lines` lines of `export const <symbol>N = N;`.
 *
 * For a check whose fixture must BE a certain length, the length is the entire
 * content of the test. Storing it costs hundreds of lines nobody reads and every
 * grep wades through, so it is written before the run and removed after — stated
 * as a number, which says more than 616 lines of filler do.
 */
export type GeneratedFixture = { path: string; lines: number; symbol: string };

export type CheckFixtures = {
  /** The catalog rule id. Must match a check registered in `scripts/registry.ts`. */
  check: string;

  /**
   * The violation the check's own header names. Each entry is `FAIL <path>` or
   * `WARN <path>`, tree-relative, listed ONCE PER OCCURRENCE.
   *
   * Compared as a multiset WITH severity, and both halves had to be. Comparing
   * bare paths as a set silently accepted three distinct regressions: a check
   * with four independent matchers passing with three of them deleted, a hard
   * error demoted to a warning, and five findings where one was expected.
   *
   * The line number is deliberately not part of it. Pinning lines means editing
   * a fixture's comment header breaks an unrelated expectation, which teaches
   * people to re-baseline without reading why it moved. Multiplicity recovers
   * most of what a line would have caught.
   */
  obvious: FixtureFinding[];

  /**
   * The same violation written the way the check's natural matcher misses. This
   * is the case that decides whether the check works, and the one an author
   * writing their own fixtures will not think of.
   */
  adversarial: FixtureFinding[];

  /**
   * Tree-relative paths of fixtures that look like the violation and are legal.
   * The runner asserts each one exists AND that this check reports nothing
   * against it.
   *
   * Naming them rather than relying on the multiset comparison to catch a
   * spurious finding buys two things: a deleted legal neighbour fails loudly
   * instead of quietly reducing coverage, and the failure message can say
   * "reported something the fixtures say is legal" rather than "unexpected".
   * Over-matching is invisible to every positive case and is the defect that
   * trains people to ignore a check.
   */
  legal: string[];

  generated?: GeneratedFixture[];
};
