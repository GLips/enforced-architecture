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
// The tree's `themeModule` also holds the documented raster boundaries — a
// canvas theme or a Skia paint takes a literal by contract. Derive it from the
// token there.
//
// The domain layer is skipped because it carries no presentation, and the token
// source is skipped because it defines what everything else names. Both are
// `isStyleSubject` in lint/policy/layout.ts, which the whole style tier calls —
// these three rules and style/token-equality. A project whose domains DO style
// edits it there, once, rather than in four places that can drift apart.
//
// The rule does not check that a `var(--x)` reference names a real token. That
// needs the token source, which a per-file linter cannot import.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import { isStyleSubject } from "../../policy/layout.ts";

const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^)]*[0-9]/;
const COLOR_PROPS = new Set(["c", "bg", "color"]);

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

export const noInlineColorRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      rawColor:
        "Raw color value. Use a color token instead — `var(--app-text-secondary)`, `theme.colors.textSecondary`, or a closed color prop on the primitive (`c='dimmed'`). Tokens carry both schemes, so light and dark stay in sync and there is no dark variant to forget. See docs/architecture/design-system.md.",
    },
  },
  create(context, role) {
    // Two gates, one owner. `isStyleSubject` is what the whole style tier —
    // these three rules and style/token-equality — asks before reading a line,
    // and it is one function rather than four copies because the copies
    // disagreed: two of these rules had the domain gate, one did not. The token
    // source is a named MODULE in the tree's vocabulary rather than a path
    // suffix, so a `legacy-theme.ts` beside it does not inherit the exemption.
    if (!isStyleSubject(role.tree.vocabulary, role.sourcePath)) return {};

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
