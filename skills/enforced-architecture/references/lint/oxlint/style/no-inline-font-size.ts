// ─── style/no-inline-font-size ────────────────────────────────────────
//
// Makes sure: No style object and no JSX prop sets `fontSize`. Every text size
// comes from a named entry on the type scale, so a change to the scale reaches
// every screen. When a surface needs a size the scale does not hold, you add it
// to the scale, and the next surface finds it there.
//
// The rule bans the property, not the value, and that is the whole of it. A
// version that reports only off-scale numbers leaves `fontSize: 13` in place
// wherever 13 is on the scale today, and that call site no longer follows the
// scale the day the scale moves.
//
// A JS plugin reads the JS and TS AST only. `font-size: 13px` in a `.css` file
// keeps this rule green; `style/css-tokens` is the check that reads that file.
//
// The subject is a property being SET, so only object-literal keys and JSX
// attribute names are read. Binding the name — `const { fontSize } = theme`, or
// the assignment form — is not covered, because that is the read the message
// asks for. Nothing here stops the bound value being handed to a style prop
// afterwards; the object literal that receives it is where that is caught.
//
// A default inside that pattern — `({ fontSize = 13 }: Props)` — is not read
// either, and that one costs real coverage: 13 is a raw size the file decides.
// It is left out because reporting it would mean judging the value on one
// branch while the rest of the rule judges only the key, and the two together
// read as arbitrary. A caller that passes the prop is still caught.
//
// Add `fontWeight`, `lineHeight` or `letterSpacing` to SCALE_PROPERTIES only
// when the tokens bundle them into one named variant. Where the tokens expose
// them separately, the ban names no fix, and a rule with no fix to name is one
// people disable.
//
// The tree's `themeModule` holds the scale itself and the documented raster
// boundaries — a canvas terminal, a PDF generator, a chart config takes a size
// as an API argument. Derive that number from the scale inside the exempt file.
//
// The domain layer is skipped because it carries no presentation, and the token
// source is skipped because it defines what everything else names. Both are
// `isStyleSubject` in lint/policy/layout.ts, which the whole style tier calls —
// these three rules and style/token-equality.
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
import { staticKeyName } from "../lib/static-key-name.ts";
import { type ESTree } from "@oxlint/plugins";
import { isStyleSubject } from "../../policy/layout.ts";

const SCALE_PROPERTIES = new Set(["fontSize"]);

export const noInlineFontSizeRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      rawFontSize:
        "Raw fontSize override. Use a named size from the type scale instead — a size prop on the text primitive (`size='caption'`, `variant='heading-xs'`) or the scale token (`var(--text-caption)`, `theme.typography.caption`). If the size you want is not on the scale, add it to the scale rather than writing it here. See docs/architecture/design-system.md.",
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
      Property(node) {
        // A destructuring pattern or an assignment target reads a size; it does not set one.
        // `const { fontSize } = theme.typography.caption` is the remedy this rule's own message
        // names, so reporting it would send the reader in a circle.
        if (node.parent.type !== "ObjectExpression") return;

        // oxlint fires this visitor for destructuring and assignment-target properties too, and all
        // four kinds carry the same `key`/`computed` pair the owner reads. The ones that are not
        // object literals are dropped on the parent above, where the reason is written down.
        const name = staticKeyName(node.key, node.computed);
        if (name !== undefined && SCALE_PROPERTIES.has(name)) {
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
