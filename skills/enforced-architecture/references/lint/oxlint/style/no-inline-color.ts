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
// A colour literal inside a utility class — `bg-[#0a0c10]` — is NOT this rule's
// finding. `style/no-arbitrary-class-values` owns it, because the fix inside a
// class string is the mapped token class (`bg-surface`), and this rule's own
// message prescribes `var(--app-surface)`, which as a class is that rule's
// `arbitraryVar`. One defect, two messages, and doing what either says leaves
// the other true. `lib/color-literals.ts` holds the boundary and the pattern
// both rules match with.
//
// Do not add bare color keywords (`red`, `dimmed`) to COLOR_LITERAL. Several
// token systems spell a token name as a keyword, so the rule would report the
// fix.
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
// NEGATIVE SPACE on the value side, and it is one line: only a value that IS a
// static string is read. A cast, a `satisfies`, a `!` and a parenthesis are
// stepped through, so `c={"#0a0c10" as Color}` is a finding — but a ternary, a
// logical, and a concatenation each ship something different from what they
// contain, and this rule has no answer for which arm is the colour. A literal
// assembled at run time is `style/token-equality`'s tier.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { COLOR_LITERAL, withoutUtilityClasses } from "../lib/color-literals.ts";
import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import { isStyleSubject } from "../../policy/layout.ts";
import { withoutTransparentWrappers } from "../lib/transparent-wrappers.ts";

const COLOR_PROPS = new Set(["c", "bg", "color"]);

/**
 * Whether a string carries a colour literal THIS rule owns.
 *
 * `lib/color-literals.ts` holds both halves and says why the boundary falls where it does. The
 * short version: a hex inside `bg-[…]` is a class-string defect whose fix is the mapped token
 * class, and `style/no-arbitrary-class-values` is the rule whose message names it.
 */
function carriesOwnedColorLiteral(text: string): boolean {
  return COLOR_LITERAL.test(withoutUtilityClasses(text));
}

/**
 * The compile-time string an expression evaluates to, or null when there isn't one.
 *
 * A backtick is a spelling of a string literal, not a different kind of value, so
 * `` color: `#0a0c10` `` has to resolve the same way `color: "#0a0c10"` does. A template with
 * interpolations is genuinely runtime-assembled and unreadable here — see `style/token-equality`
 * for the tier that can follow it.
 */
function staticStringValue(wrapped: ESTree.Node): string | null {
  // A cast, a `satisfies`, a `!` and a parenthesis change nothing about the string that ships, and
  // `lib/transparent-wrappers.ts` is the one list of them. Without this, `c={"#0a0c10" as Color}`
  // turns the rule off with one keyword, while `style/no-inline-style-prop` — which reads the same
  // module — still sees it.
  const node = withoutTransparentWrappers(wrapped);
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
        if (value !== null && carriesOwnedColorLiteral(value)) {
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
        if (text !== null && carriesOwnedColorLiteral(text)) {
          context.report({ node, messageId: "rawColor" });
        }
      },
    };
  },
});
