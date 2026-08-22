import type { Rule } from "@oxlint/plugins";
// node:test, not bun:test — oxlint's RuleTester parses in Rust and shares the AST by zero-copy raw
// transfer, which needs an ArrayBuffer JavaScriptCore cannot allocate. oxlint refuses Bun by name
// with no slower path to opt into, so every spec runs under real Node >= 22. See harness/README.md.
import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";
import { classifyFileRole, DECLARED_TREES } from "../../policy/declared-trees.ts";
import { isTreeScopedRule } from "./define-tree-rule.ts";

RuleTester.describe = describe;
RuleTester.it = it;

export type Violation = RuleTester.InvalidTestCase;
export type Legal = RuleTester.ValidTestCase;

/**
 * Every spec filename in this catalog is written under `/repo`, and this constant is the ONE
 * project root both readers measure from: the `RuleTester` below hands it to the rules as cwd,
 * and `reachesTreeScopedRule` resolves against the same value — one constant, so the two cannot
 * disagree about which tree a fixture is in.
 *
 * NEGATIVE SPACE: a tester built WITHOUT the cwd falls back to the directory holding the spec
 * file, and the refusal below cannot see that — it reads this constant, not the tester. What
 * catches it is every violation kind failing on its error count.
 */
const SPEC_PROJECT_ROOT = "/repo";

/**
 * True when the rule under test will actually visit this case's file: the filename resolves into a
 * declared tree and is not architecture-exempt. Asked of the SAME predicate `defineTreeRule` gates
 * `create` on, deliberately — a private copy of "does this file reach the rule" is a second answer
 * that drifts from the one the rule gives.
 */
function reachesTreeScopedRule(testCase: Violation | Legal): boolean {
  return (
    testCase.filename !== undefined &&
    classifyFileRole(testCase.filename, SPEC_PROJECT_ROOT) !== undefined
  );
}

/**
 * The three-kind contract, made structural.
 *
 * A rule's failure mode is silent by construction: when it stops matching it does not error, it
 * approves everything, and a green run is indistinguishable from a working one. Positive cases
 * alone cannot see over-matching, and one obvious violation cannot see the spelling the rule's
 * natural pattern misses. So every rule in this catalog proves all three:
 *
 *   obvious      — the violation the rule's own header names.
 *   adversarial  — the same violation written the way the rule's natural pattern misses. This is
 *                  the case that decides whether the rule works, and the one an author writing
 *                  their own spec will not think of.
 *   legal        — code that looks like the violation and is allowed. Over-matching is the defect
 *                  that trains people to ignore a rule.
 *
 * Passing the three as named arguments is what makes a missing kind impossible rather than merely
 * discouraged, and the empty check is what stops a stubbed-out spec from passing on zero cases —
 * the failure this catalog's previous harness was rebuilt to catch. The fixture-resolution check
 * is the same refusal one level up: a kind can be populated and still assert nothing, when a
 * tree-scoped rule resolves every one of its filenames to no declared tree and installs no
 * visitor. That is what a spec spelled against the catalog's example tree does in a repo that
 * declares a different root — the legal cases pass on zero coverage, and the violation cases fail
 * as a bare count mismatch that names nothing. Rebasing the fixture filenames onto the declared
 * roots is part of adapting the specs, and this throw is what says so.
 *
 * The holds are asymmetric, and that is why deleting either throw is not a local decision. The
 * empty check has two: `harness/run-rule-fixtures.ts` probes the refusal directly AND counts the
 * cases each kind ran. The fixture-resolution check has ONE — that runner's rebased-kind probe —
 * because unresolved cases still run and still count: RuleTester lints them, the rule just
 * installs no visitor. For that check, the probe is the only thing between a deleted throw and a
 * green run.
 */
export function describeRule(
  ruleId: string,
  rule: Rule,
  cases: { obvious: Violation[]; adversarial: Violation[]; legal: Legal[] },
): void {
  for (const kind of ["obvious", "adversarial", "legal"] as const) {
    if (cases[kind].length === 0) {
      throw new Error(`${ruleId}: the ${kind} case list is empty, so it asserts nothing`);
    }
    // One reaching case per kind, not all of them: a filename outside every declared tree, or an
    // architecture-exempt one, is how a legal list proves the gate's silence on purpose. Only for
    // rules that carry the tree gate — a global rule's fixtures may legitimately sit outside every
    // tree, and `testing/no-module-mocking`'s obvious and adversarial kinds, all test files, are
    // the standing proof: apply this refusal to plain rules and that spec throws at load.
    //
    // NEGATIVE SPACE: reaching is resolution into a declared ROOT, not into the tree's
    // vocabulary. A fixture at `src/modules/...` in a tree whose vocabulary spells `features/`
    // resolves, reaches the rule with an unclaimed place, and matches most rules nowhere — a
    // renamed vocabulary still needs its fixtures respelled by hand, and nothing here says so.
    if (isTreeScopedRule(rule) && !cases[kind].some(reachesTreeScopedRule)) {
      const roots = DECLARED_TREES.map((tree) => `"${tree.root}"`).join(", ");
      throw new Error(
        `${ruleId}: no ${kind} case filename reaches the rule — every one either resolves into ` +
          `no declared tree or is architecture-exempt, so the rule installs no visitor and the ` +
          `whole ${kind} list runs against nothing. Fixture filenames are spelled from ` +
          `"${SPEC_PROJECT_ROOT}" and the declared roots are ${roots}; rebase the filenames ` +
          `onto one of them.`,
      );
    }
  }

  // Three `run` calls rather than one, so the reporter names which kind failed. Each needs both
  // keys present — RuleTester rejects a scenario object missing either.
  const tester = new RuleTester({ cwd: SPEC_PROJECT_ROOT });
  tester.run(`${ruleId} (obvious)`, rule, { valid: [], invalid: cases.obvious });
  tester.run(`${ruleId} (adversarial)`, rule, { valid: [], invalid: cases.adversarial });
  tester.run(`${ruleId} (legal)`, rule, { valid: cases.legal, invalid: [] });
}
