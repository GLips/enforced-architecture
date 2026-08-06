// ─── style/no-inline-color ────────────────────────────────────────────
//
// Tag:       style
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Raw color values written into style objects or color props —
//           hex literals (`#0a0c10`), and `rgb()` / `rgba()` / `hsl()` /
//           `hsla()` with literal channels.
//
//           Color is the axis where drift is both easiest and least
//           visible. A model reaches for a plausible gray fluently, and
//           the result looks fine in the scheme it was written against
//           and wrong in the other one. Routing every color through the
//           token table is also what makes dark mode true by
//           construction: the token holds both schemes, so there is no
//           second variant for a model to forget, and the bug stops
//           being expressible.
//
// Applies:  All source files EXCEPT:
//           - The token source itself (it defines the raw values)
//           - Non-UI layers with no styling (domains, pure logic)
//           - Test files and scripts
//           - Documented raster/canvas boundaries (see Adapt section 1)
//
//           NOT `.css` files — a JS plugin sees the JS/TS AST only. The
//           stylesheet surface is covered by the `style/css-tokens`
//           structural check.
//
// Error:    "Raw color value. Use a color token so light and dark stay
//            in sync."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. `TOKEN_SOURCE` — the module that defines the token table. It has to
//    write the literals the tokens resolve to, so it MUST be exempt.
//    Point it at the project's `theme.ts` / `tokens.ts`. Add documented
//    raster boundaries here too: canvas / native-module APIs take a
//    literal color by contract (an xterm.js theme, a Skia paint, a
//    status-bar color). One path per line, each with a comment saying
//    why, and derive the literal from the token inside that file.
//
// 2. `NON_UI_LAYER` — layers that carry no styling at all
//    (`src/domains/` in the standard layout). This is an exemption only
//    because those layers should have nothing to say about color; if
//    yours can style, delete the constant and the check that uses it.
//
// 3. `COLOR_PROPS` — the attribute names that carry a color. The default
//    set is `c` / `bg` / `color`, and it exists so `<Text color="#fff">`
//    is caught alongside `{ color: "#fff" }`. Keep the set SMALL and
//    EXACT — matching every attribute would flag `href="#anchor"` and
//    fragment ids. Add the project's primitives' color props (`tint`,
//    `borderColor`, `backgroundColor`) if they accept strings.
//
//    If those props are typed as a closed union of token names, the type
//    system already rejects a hex and this arm is belt-and-braces for
//    the props that stayed open. That is the correct division: types own
//    the closed props, this rule owns the leaks.
//
// 4. `RAW_COLOR` — what counts as a literal color. The digit requirement
//    in the function forms is what lets `rgb(var(--x))` through. Add
//    `oklch(` / `color(` if the project's CSS uses them. Do not add bare
//    color KEYWORDS (`red`, `dimmed`): a keyword is how several token
//    systems spell a token name, so banning them here would fire on the
//    fix.
//
// 5. Name the fix (the message): the message is the only documentation
//    an agent reliably reads, so it must name the exact shape a fix
//    takes in this project — `var(--app-bg-raised)`,
//    `theme.colors.backgroundRaised`, or a closed color prop
//    (`c='dimmed'`). Replace the examples with the project's.
//
// 6. Registration: add the rule to the project's oxlint plugin
//    (`rules: { "no-inline-color": noInlineColorRule }`) and turn it on
//    in `.oxlintrc.json` (`"<plugin>/no-inline-color": "error"`).
//
// What this rule deliberately does NOT do: it does not check that a
// `var(--x)` / `theme.colors.x` reference names a REAL token. That needs
// the token source, which a per-file linter cannot import — see
// `style/token-equality` for the tier that can.
//
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
