// ─── The tree gate, as a wrapper rather than a line every rule remembers ──
//
// Every architecture rule in this catalog is silent outside the declared trees.
// That was 49 copies of the same two lines at the top of 49 `create` bodies, and
// two lines a rule can simply not have are not an invariant — they are a
// convention. A rule that loses them keeps every one of its specs green, because
// every spec filename is INSIDE a declared tree: there is nothing in the
// three-kind contract that asks what the rule does outside one.
//
// A harness check that greps rule sources for `classifyFileRole` does not close
// this. It proves the identifier is present, not that it controls execution —
// delete the condition and leave the import, and the grep still passes. That was
// the state this file replaces, and it is exactly the "silently stops matching"
// failure the catalog exists to prevent.
//
// So the gate is not something a rule does. `create` is handed a `FileRole` that
// cannot be undefined, and the only way to obtain one is through this wrapper.
// A rule cannot opt out by forgetting.
//
// NEGATIVE SPACE, and it is the point of the second export: a rule whose subject
// is NOT application source uses plain `defineRule` and is enabled globally.
// `testing/no-module-mocking` is the only one — its subject is test files, which
// `classifyFileRole` reports as no subject at all. Membership here is what the
// spec harness reads to decide which block of the shipped config a rule belongs
// in, in both directions, so the two cannot disagree.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type Context, type Rule, type Visitor } from "@oxlint/plugins";
import { classifyFileRole, type FileRole } from "../../policy/declared-trees.ts";

/**
 * The rules that resolve their file against the declared trees.
 *
 * A runtime set rather than a list anyone maintains: a rule joins it by being
 * built with `defineTreeRule`, which is the same act that gives it the gate.
 * There is no way to be in one and not the other.
 */
const TREE_SCOPED_RULES = new Set<Rule>();

type TreeRuleDefinition = {
  meta: Parameters<typeof defineRule>[0]["meta"];
  create: (context: Context, role: FileRole) => Visitor;
};

export function defineTreeRule(definition: TreeRuleDefinition): Rule {
  const rule = defineRule({
    meta: definition.meta,
    create(context) {
      // The one gate, and the reason `role` is a parameter of the definition's
      // `create` rather than something its body fetches: a rule body never sees
      // the undefined case, so it cannot forget to handle it.
      const role = classifyFileRole(context.filename);
      if (role === undefined) return {};
      return definition.create(context, role);
    },
  });
  TREE_SCOPED_RULES.add(rule);
  return rule;
}

/** True when `rule` was built with `defineTreeRule`, and so carries the gate. */
export function isTreeScopedRule(rule: unknown): boolean {
  return TREE_SCOPED_RULES.has(rule as Rule);
}
