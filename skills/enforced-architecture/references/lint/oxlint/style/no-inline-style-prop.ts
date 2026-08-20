// ─── style/no-inline-style-prop ───────────────────────────────────────
//
// Tag:       style
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Inline `style={{ ... }}` object literals in feature code.
//
//           An inline style object is an unconstrained surface: it takes
//           any property at any value, so it is the one place in a
//           tokenised codebase where an arbitrary decision still
//           typechecks. Closing it forces styling back through the
//           primitives' token props, or into a named stylesheet the
//           other rules in this tag can see.
//
// Applies:  All component files EXCEPT:
//           - The primitives layer (it needs the raw surface to build on)
//           - Test files and scripts
//
// Error:    "Inline style object. Use the primitive's token props, or a
//            named style in the stylesheet."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 0. DECIDE WHETHER YOU WANT THIS RULE AT ALL. It is the strictest rule
//    in the tag and the one most likely to be wrong for a project.
//
//    Take it when the project has a stylesheet layer that inline styles
//    would bypass — React Native with Unistyles or `StyleSheet.create`,
//    StyleX, vanilla-extract, CSS modules. There, an inline object skips
//    the theming and variant machinery entirely, and there is always a
//    named place for the style to live instead.
//
//    Leave it out when inline style is the project's sanctioned escape
//    hatch for things props cannot express — flex idioms
//    (`minHeight: 0`, `flexShrink`), a computed one-off dimension, a
//    `var(--token)` reference. Banning it there does not remove the
//    need; it just relocates it into a worse shape (a CSS module for two
//    declarations, or a `styles` prop that dodges the linter). In that
//    project, `no-inline-color` / `no-inline-font-size` /
//    `token-equality` already police what goes INSIDE the object, which
//    is where the drift actually is. That is the narrower, more honest
//    rule set — prefer it unless the stylesheet-bypass argument applies.
//
// 1. `PRIMITIVES_LAYER` — where the design system's `<Box>` / `<Text>`
//    live. This exemption is MANDATORY: the primitives are what turn
//    token props into real style declarations, so without it the rule
//    forbids them from being implemented at all. Default is
//    `src/shared/ui/`.
//
// 2. `STYLE_PROPS` — the attribute names that take a style object.
//    `style` covers React DOM and React Native; add `contentContainerStyle`
//    or a project-specific `sx` / `css` prop if those accept an object
//    literal too.
//
// 3. Escape hatch by path, not by suppression: if a handful of files
//    genuinely need inline style (an animated style driven by a shared
//    value, a measured layout), add them to `PRIMITIVES_LAYER`'s
//    alternation with a comment. Do not add an inline-suppression comment
//    convention — that turns a hard boundary into a soft one, and agents
//    learn the suppression faster than the rule.
//
// 4. Object literals only: `style={someVar}` is deliberately NOT a
//    violation. A variable reference usually points at a named stylesheet
//    entry — exactly the shape this rule steers toward — so catching it
//    would punish the fix. What IS caught is every spelling that still
//    ships a literal: a cast, a ternary branch, and an element of a
//    React Native style array.
//
// 5. Registration: add the rule to the project's oxlint plugin
//    (`rules: { "no-inline-style-prop": noInlineStylePropRule }`) and
//    turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-inline-style-prop": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const STYLE_PROPS = new Set(["style"]);

// Anchored on `/src/` so a feature's own `shared/ui/` folder, or a `src/shared/ui-legacy/`, does
// not inherit the primitives layer's exemption.
const PRIMITIVES_LAYER = /\/src\/shared\/ui\//;

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
  switch (node.type) {
    case "ObjectExpression":
      return true;
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
      return shipsObjectLiteral(node.expression);
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

export const noInlineStylePropRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      inlineStyleObject:
        "Inline style object. Use the primitive's token props (padding='m', gap='s', color='text-secondary'), or move the declarations into a named stylesheet entry. An inline object accepts any property at any value, so it is the one surface where an off-system decision still typechecks. See docs/architecture/design-system.md.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename) || PRIMITIVES_LAYER.test(filename)) return {};

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
