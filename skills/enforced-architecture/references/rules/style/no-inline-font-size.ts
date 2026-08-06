// ─── style/no-inline-font-size ────────────────────────────────────────
//
// Tag:       style
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Raw `fontSize` overrides in style objects and props.
//
//           Type scale is a closed set by nature — a project has a
//           handful of named sizes, and any value outside them is drift.
//           Unlike a width or a height, there is no such thing as a
//           legitimate one-off font size: if a surface needs a size the
//           scale does not have, the scale is wrong, and hand-writing
//           `fontSize: 13` hides that instead of surfacing it. So this
//           rule bans the property outright rather than checking the
//           value, which is what separates it from
//           `style/token-equality`.
//
// Applies:  All source files EXCEPT:
//           - The token source itself
//           - Non-UI layers with no styling
//           - Test files and scripts
//           - Documented raster/canvas boundaries (see Adapt section 3)
//
//           NOT `.css` files — a JS plugin sees the JS/TS AST only. The
//           stylesheet surface is covered by the `style/css-tokens`
//           structural check.
//
// Error:    "Raw fontSize override. Use a named size from the type
//            scale."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. `TOKEN_SOURCE` — the module that defines the type scale. It has to
//    write the raw numbers the named sizes resolve to, so it MUST be
//    exempt. Point it at the project's `theme.ts` / `tokens.ts`. Add
//    documented raster boundaries here too — a canvas terminal, a PDF
//    generator, a chart config takes a size as an API argument rather
//    than as chrome typography. One path per line, each with a comment
//    saying why, and derive the number from the scale inside that file.
//
// 2. `NON_UI_LAYER` — layers that carry no styling at all (`src/domains/`
//    in the standard layout). This is an exemption only because those
//    layers should have nothing to say about type; if yours can style,
//    delete the constant and the check that uses it.
//
// 3. `SCALE_PROPERTIES` — the property names that belong to the closed
//    scale. `fontWeight`, `lineHeight`, and `letterSpacing` are usually
//    part of the same one. If the project's tokens bundle all four into a
//    single `variant` (the stronger design — one decision, not four), add
//    them here. If the tokens expose them separately, leave this on
//    `fontSize` alone rather than banning properties that have no token
//    to point at.
//
//    The set is checked against BOTH object-literal keys and JSX
//    attribute names, so `{ fontSize: 13 }` and `<Text fontSize={13}>`
//    are the same violation. A prop that carries a scale TOKEN
//    (`fz="var(--text-caption)"`, `size="caption"`) is a different name
//    and stays legal — that is the fix this rule steers toward.
//
// 4. Name the fix (the message): point at the project's actual type
//    scale and the prop that reaches it — `size="caption"`,
//    `fz="var(--text-caption)"`, `variant="heading-xs"`,
//    `theme.typography.caption`. Include the file the scale lives in;
//    that is where an agent goes next when the size it wanted is not
//    there.
//
// 5. Registration: add the rule to the project's oxlint plugin
//    (`rules: { "no-inline-font-size": noInlineFontSizeRule }`) and turn
//    it on in `.oxlintrc.json`
//    (`"<plugin>/no-inline-font-size": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const SCALE_PROPERTIES = new Set(["fontSize"]);

// Anchored on `/src/` so a sibling that merely ends in the same word — a `legacy-theme.ts`, a
// package called `domains-utils` — does not inherit the exemption.
const TOKEN_SOURCE = /\/src\/shared\/ui\/theme\.ts$/;
const NON_UI_LAYER = /\/src\/domains\//;

/**
 * The static name of a non-computed property key.
 *
 * `{ "fontSize": 13 }` is the same property as `{ fontSize: 13 }` — the quotes are a spelling, not
 * a different key — so both spellings resolve here. A computed key (`{ [prop]: 13 }`) has no
 * static name at all, and returning null is how the rule says so rather than guessing.
 */
function staticPropertyKeyName(property: ESTree.ObjectProperty): string | null {
  if (property.computed) return null;
  const { key } = property;
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

export const noInlineFontSizeRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      rawFontSize:
        "Raw fontSize override. Use a named size from the type scale instead — a size prop on the text primitive (`size='caption'`, `variant='heading-xs'`) or the scale token (`var(--text-caption)`, `theme.typography.caption`). If the size you want is not on the scale, add it to the scale rather than writing it here. See docs/architecture/design-system.md.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};
    if (TOKEN_SOURCE.test(filename) || NON_UI_LAYER.test(filename)) return {};

    return {
      Property(node) {
        const name = staticPropertyKeyName(node);
        if (name !== null && SCALE_PROPERTIES.has(name)) {
          context.report({ node, messageId: "rawFontSize" });
        }
      },

      JSXAttribute(node) {
        // A namespaced attribute (`<svg xlink:href>`) is never a style prop.
        if (node.name.type !== "JSXIdentifier") return;
        if (SCALE_PROPERTIES.has(node.name.name)) {
          context.report({ node, messageId: "rawFontSize" });
        }
      },
    };
  },
});
