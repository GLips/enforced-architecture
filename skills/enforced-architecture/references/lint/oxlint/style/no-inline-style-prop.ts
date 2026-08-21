// ─── style/no-inline-style-prop ───────────────────────────────────────
//
// Makes sure: Outside the primitives layer, no `style` prop carries an object
// literal. Every declaration sits in a primitive's token props or in a named
// stylesheet entry. To change the spacing unit you edit the theme module, and
// you never read each JSX attribute for a hand-written `padding`.
//
// Take this rule only where a style has a named place to live: a stylesheet
// layer, `StyleSheet.create`, StyleX, vanilla-extract, CSS modules. Elsewhere
// the ban moves the same object into a `styles` prop that no rule reads.
//
// The primitives-layer exemption is mandatory. The primitives turn token props
// into real declarations, so without it the rule forbids its own fix.
//
// `style={someVar}` passes on purpose. A variable usually names a stylesheet
// entry, which is the shape this rule asks for, so a report there fires on the
// fix.
//
// STYLE_PROPS holds one name. A project with an `sx` or `contentContainerStyle`
// prop that takes an object keeps this rule green while the object ships.
//
// Do not add a suppression comment. A file that must write inline style joins
// PRIMITIVES_LAYER with a reason; agents learn a suppression faster than a rule.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { isTransparentWrapper } from "../lib/transparent-wrappers.ts";
import { type ESTree } from "@oxlint/plugins";
import { isAtProfile } from "../../policy/declared-trees.ts";

const STYLE_PROPS = new Set(["style"]);

/**
 * Whether an expression ships an object literal, through any of the wrappers that keep one from
 * being the top node.
 *
 * The literal is the violation; a cast, a ternary, or a style ARRAY is packaging around it. React
 * Native's `style={[styles.row, { padding: 12 }]}` is the spelling that matters most here — this
 * rule is aimed squarely at stylesheet-bearing projects, and in those the array form is the
 * idiomatic way to write the very thing the rule bans.
 */
function shipsObjectLiteral(node: ESTree.Node): boolean {
  // The wrappers that change nothing about the value are `lib/transparent-wrappers.ts`'s to list,
  // not this rule's. The private copy here named four of the five and was the only place in the
  // catalog that carried `TSTypeAssertion` for a JSX attribute — a branch no input reaches, since
  // `<never>{…}` does not parse in a .tsx file. The arms below are NOT that list: a ternary, a
  // logical, and a style array each ship something different from what they contain, which is why
  // this rule answers for them and the shared module refuses to.
  if (isTransparentWrapper(node)) return shipsObjectLiteral(node.expression);
  switch (node.type) {
    case "ObjectExpression":
      return true;
    case "ConditionalExpression":
      return shipsObjectLiteral(node.consequent) || shipsObjectLiteral(node.alternate);
    case "LogicalExpression":
      return shipsObjectLiteral(node.left) || shipsObjectLiteral(node.right);
    case "ArrayExpression":
      return node.elements.some(
        (element) => element !== null && shipsObjectLiteral(element),
      );
    default:
      return false;
  }
}

export const noInlineStylePropRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      inlineStyleObject:
        "Inline style object. Use the primitive's token props (padding='m', gap='s', color='text-secondary'), or move the declarations into a named stylesheet entry. An inline object accepts any property at any value, so it is the one surface where an off-system decision still typechecks. See docs/architecture/design-system.md.",
    },
  },
  create(context, role) {
    // The primitives layer as a PROFILE, so a feature's own `shared/ui/` folder,
    // or a `shared/ui-legacy/`, does not inherit its exemption.
    if (isAtProfile(role, "shared-ui")) return {};

    return {
      JSXAttribute(node) {
        // A namespaced attribute (`<svg xlink:href>`) is never a style prop.
        if (node.name.type !== "JSXIdentifier") return;
        if (!STYLE_PROPS.has(node.name.name)) return;

        const { value } = node;
        // `style="…"` is a string, and `style` with no value is a boolean shorthand — neither
        // carries an object.
        if (value === null || value.type !== "JSXExpressionContainer") return;
        if (shipsObjectLiteral(value.expression)) {
          context.report({ node, messageId: "inlineStyleObject" });
        }
      },
    };
  },
});
