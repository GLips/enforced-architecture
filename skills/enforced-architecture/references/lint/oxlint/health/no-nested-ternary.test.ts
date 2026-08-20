import { describeRule } from "../lib/rule-spec.ts";
import { noNestedTernaryRule } from "./no-nested-ternary.ts";

const HELPER = "/repo/src/features/billing/service/label.ts";
const COMPONENT = "/repo/src/features/billing/ui/badge.tsx";

describeRule("health/no-nested-ternary", noNestedTernaryRule, {
  obvious: [
    {
      name: "three conditionals chained in one expression",
      filename: HELPER,
      code: `export const label = (n: number) => (n > 100 ? "high" : n > 50 ? "mid" : n > 10 ? "low" : "none");`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      name: "the same chain as a JSX attribute value",
      filename: COMPONENT,
      code: `export const Badge = ({ n }: { n: number }) => <span className={n > 100 ? "a" : n > 50 ? "b" : n > 10 ? "c" : "d"} />;`,
      errors: [{ messageId: "deeplyNested" }],
    },
  ],

  adversarial: [
    {
      // The port's headline defect: `contains` bound the FIRST nested ternary and never backtracked,
      // so the harmless `q ? 1 : 2` in the first attribute satisfied the inner match and the real
      // three-deep chain in the second attribute was never looked at.
      name: "an earlier shallow ternary must not mask a deeper chain behind it",
      filename: COMPONENT,
      code: `export const Row = ({ p, q, r, s }) => (p ? <X label={q ? 1 : 2} foot={r ? (s ? 3 : 4) : 5} /> : null);`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      name: "the nesting hangs off the consequent branch rather than the chained alternate",
      filename: HELPER,
      code: `export const tone = (n: number) => (n > 0 ? (n > 10 ? (n > 100 ? "a" : "b") : "c") : "d");`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      name: "depth counts through an intervening call expression",
      filename: HELPER,
      code: `export const tone = (p, q, r) => (p ? 1 : wrap(q ? (r ? 3 : 4) : 5));`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      name: "a four-deep chain reports each conditional that is itself too deep, not one per file",
      filename: HELPER,
      code: `export const tier = (a, b, c, d) => (a ? 1 : b ? 2 : c ? 3 : d ? 4 : 5);`,
      errors: [{ messageId: "deeplyNested" }, { messageId: "deeplyNested" }],
    },
    {
      name: "two unrelated deep chains in one file are two findings, not one",
      filename: HELPER,
      code: `export const first = (a, b, c) => (a ? 1 : b ? 2 : c ? 3 : 4);
export const second = (x, y, z) => (x ? 1 : y ? 2 : z ? 3 : 4);`,
      errors: [{ messageId: "deeplyNested" }, { messageId: "deeplyNested" }],
    },
    {
      name: "the chain spread over several lines, where no single line looks nested",
      filename: HELPER,
      code: `export const spread = (n: number) =>
  n > 0
    ? "positive"
    : n < -100
      ? "very negative"
      : n < 0
        ? "negative"
        : "zero";`,
      errors: [{ messageId: "deeplyNested" }],
    },
  ],

  legal: [
    {
      name: "two conditionals is the documented budget",
      filename: HELPER,
      code: `export const status = (n: number) => (n > 50 ? "high" : n > 10 ? "low" : "none");`,
    },
    {
      name: "conditionals in the TEST position are separate decisions, not nested outcomes",
      filename: HELPER,
      code: `export const pick = (b, c, d, e, f, g) => ((b ? c : d) ? 1 : e ? f : g);`,
    },
    {
      name: "sibling conditionals in one array literal are not nested in each other",
      filename: HELPER,
      code: `export const cells = (x, y, z) => [x ? 1 : 2, y ? 3 : 4, z ? 5 : 6];`,
    },
    {
      name: "a chain extracted to its own binding is the refactor the rule asks for",
      filename: HELPER,
      code: `const inner = (a, b) => (a ? 1 : b ? 2 : 3);
export const outer = (a, b, c) => (c ? inner(a, b) : 0);`,
    },
    {
      name: "a ternary beside an if/else chain",
      filename: HELPER,
      code: `export const tone = (n: number) => {
  if (n > 100) return "high";
  if (n > 50) return "mid";
  return n > 10 ? "low" : "none";
};`,
    },
    {
      name: "a test file may spell a fixture however it likes",
      filename: "/repo/src/features/billing/service/label.test.ts",
      code: `const label = (n: number) => (n > 100 ? "high" : n > 50 ? "mid" : n > 10 ? "low" : "none");`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-labels.ts",
      code: `const label = (n: number) => (n > 100 ? "high" : n > 50 ? "mid" : n > 10 ? "low" : "none");`,
    },
    {
      // The other half of the generated exemption: a whole DIRECTORY the tree
      // declares as generated, holding files the generator stamped no `.gen` on.
      // Both tiers read `generatedDirs`, so this file is exempt here and exempt
      // to the structural checks — while only the shipped ignore pattern read
      // the list, the linter skipped it and the structural tier reported it.
      name: "a generated directory the tree declared, on a file with no .gen in its name",
      filename: "/repo/src/gen/graphql-client.ts",
      code: `export const label = (n: number) => (n > 100 ? "high" : n > 50 ? "mid" : n > 10 ? "low" : "none");`,
    },
    {
      name: "a directory that merely contains the word 'test' is not a test path",
      filename: "/repo/src/features/billing/latest-labels/label.ts",
      code: `export const status = (n: number) => (n > 50 ? "high" : n > 10 ? "low" : "none");`,
    },
  ],
});
