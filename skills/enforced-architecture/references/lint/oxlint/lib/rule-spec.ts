import type { Rule } from "@oxlint/plugins";
// node:test, not bun:test — oxlint's RuleTester parses in Rust and shares the AST by zero-copy raw
// transfer, which needs an ArrayBuffer JavaScriptCore cannot allocate. oxlint refuses Bun by name
// with no slower path to opt into, so every spec runs under real Node >= 22. See harness/README.md.
import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";

RuleTester.describe = describe;
RuleTester.it = it;

export type Violation = RuleTester.InvalidTestCase;
export type Legal = RuleTester.ValidTestCase;

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
 * the failure this catalog's previous harness was rebuilt to catch.
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
  }

  // Every spec filename in this catalog is written under `/repo`, so `/repo` is the project root
  // the rules resolve declared trees against. This has to be stated rather than defaulted:
  // RuleTester's default cwd is the directory holding the spec file, which is inside this
  // repository — under that root no `/repo/src/...` filename is in any declared tree, every
  // tree-scoped rule returns early, and all 50 specs go green on zero coverage.
  const SPEC_PROJECT_ROOT = "/repo";

  // Three `run` calls rather than one, so the reporter names which kind failed. Each needs both
  // keys present — RuleTester rejects a scenario object missing either.
  const tester = new RuleTester({ cwd: SPEC_PROJECT_ROOT });
  tester.run(`${ruleId} (obvious)`, rule, { valid: [], invalid: cases.obvious });
  tester.run(`${ruleId} (adversarial)`, rule, { valid: [], invalid: cases.adversarial });
  tester.run(`${ruleId} (legal)`, rule, { valid: cases.legal, invalid: [] });
}
