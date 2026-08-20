// ─── style/no-inline-color ────────────────────────────────────────────
//
// Makes sure: No style-object value and no color prop carries a hex, `rgb()`,
// or `hsl()` literal. Every color in the JS and TSX source comes from the token
// table, and each token holds both schemes. To change the brand color, or to
// add a dark theme, you edit the token table and no component file.
//
// A JS plugin reads the JS and TS AST only. `color: #0a0c10` in a `.css` file
// keeps this rule green; `style/css-tokens` is the check that reads that file.
//
// Do not add bare color keywords (`red`, `dimmed`) to RAW_COLOR. Several token
// systems spell a token name as a keyword, so the rule would report the fix.
//
// Keep COLOR_PROPS small and exact. A rule that reads every attribute reports
// `href="#anchor"` and every fragment id.
//
// TOKEN_SOURCE also holds the documented raster boundaries — a canvas theme or
// a Skia paint takes a literal by contract. Derive it from the token there.
//
// NON_UI_LAYER assumes the domain layer carries no style. If yours does, delete
// the constant and its `filename` test; otherwise this rule skips those files.
//
// The rule does not check that a `var(--x)` reference names a real token. That
// needs the token source, which a per-file linter cannot import.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^)]*[0-9]/;
const COLOR_PROPS = new Set(["c", "bg", "color"]);

// Anchored on `/src/` so a sibling that merely ends in the same word — a `legacy-theme.ts`, a
// package called `domains-utils` — does not inherit the exemption.
const TOKEN_SOURCE = /\/src\/shared\/ui\/theme\.ts$/;
const NON_UI_LAYER = /\/src\/domains\//;

/**
 * The compile-time string an expression evaluates to, or null when there isn't one.
 *
 * A backtick is a spelling of a string literal, not a different kind of value, so
 * `` color: `#0a0c10` `` has to resolve the same way `color: "#0a0c10"` does. A template with
 * interpolations is genuinely runtime-assembled and unreadable here — see `style/token-equality`
 * for the tier that can follow it.
 */
function staticStringValue(node: ESTree.Node): string | null {
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

export const noInlineColorRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      rawColor:
        "Raw color value. Use a color token instead — `var(--app-text-secondary)`, `theme.colors.textSecondary`, or a closed color prop on the primitive (`c='dimmed'`). Tokens carry both schemes, so light and dark stay in sync and there is no dark variant to forget. See docs/architecture/design-system.md.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};
    if (TOKEN_SOURCE.test(filename) || NON_UI_LAYER.test(filename)) return {};

    return {
      // Style-object values: `{ color: "#fff" }`, `{ backgroundColor: "rgb(0,0,0)" }`. Inline
      // `style={{}}`, StyleSheet.create objects, and theme-adjacent literals are all this one
      // shape. The KEY is deliberately not consulted — a raw color is off-system whatever it is
      // assigned to, which is also why a computed key needs no special case here.
      Property(node) {
        const value = staticStringValue(node.value);
        if (value !== null && RAW_COLOR.test(value)) {
          context.report({ node, messageId: "rawColor" });
        }
      },

      // Color props on components: `<Text c="#fff">`.
      JSXAttribute(node) {
        // A namespaced attribute (`<svg xlink:href>`) is never a color prop.
        if (node.name.type !== "JSXIdentifier") return;
        if (!COLOR_PROPS.has(node.name.name)) return;

        const { value } = node;
        if (value === null) return;
        // `c="#fff"` is a bare string; `c={"#fff"}` and `` c={`#fff`} `` wrap the same value in an
        // expression container, and all three ship the same color.
        const inner = value.type === "JSXExpressionContainer" ? value.expression : value;
        const text = staticStringValue(inner);
        if (text !== null && RAW_COLOR.test(text)) {
          context.report({ node, messageId: "rawColor" });
        }
      },
    };
  },
});
