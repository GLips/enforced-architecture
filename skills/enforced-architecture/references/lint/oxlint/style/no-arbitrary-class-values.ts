// ─── style/no-arbitrary-class-values ──────────────────────────────────
//
// Tag:       style
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Utility-class strings that carry a raw value or a raw scale
//           step instead of a semantic token — `text-[13px]`,
//           `bg-[#0a0c10]`, `bg-[var(--background)]`, `text-sm`.
//
//           This is the rule for projects on Tailwind or another
//           utility-CSS framework, and it exists because a class string
//           is untyped. Everything else the type system can hold shut,
//           `className` reopens: arbitrary-value syntax (`p-[7px]`) is a
//           blank cheque, and the framework's own generic scale
//           (`text-sm`, `text-2xl`) is a second vocabulary competing
//           with the project's semantic one. Both give a model infinite
//           room to be slightly wrong, in a surface no compiler reads.
//
// Applies:  All source files EXCEPT:
//           - The token / theme configuration
//           - Test files and scripts
//
// Error:    "Off-token utility class. Use the semantic token class."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Three independent patterns, each with its own messageId. Keep the
//    ones that match your setup; delete a pattern and its `messageId`
//    together.
//
//    - `ARBITRARY_VALUE_UTILITY` — `text-[13px]`, `p-[7px]`, `bg-[#fff]`.
//      Always keep this one; the bracket syntax has no legitimate use in
//      a tokenised project.
//
//    - `ARBITRARY_VAR_UTILITY` — `bg-[var(--background)]`. Reaching a CSS
//      variable through bracket syntax works, which is exactly why it is
//      worth banning: it bypasses the theme mapping, so the token exists
//      in two places and only one of them is checked. Keep this if your
//      tokens are registered in the framework theme (they should be) —
//      then `bg-background` is the supported spelling. The prefix
//      alternation inside it is the list of properties your tokens cover.
//
//    - `GENERIC_SCALE_UTILITY` — `text-sm`, `text-2xl`. Keep this only
//      once semantic type classes exist to replace them (`text-body`,
//      `text-caption`, `text-section-title`). Turning it on before the
//      semantic scale is defined leaves agents with a banned class and no
//      allowed one, and they will reach for the bracket syntax instead.
//      Define the scale first, then close the generic one.
//
//    All three report on the same string in one pass, so
//    `className="text-[13px] text-sm"` surfaces both violations now
//    rather than one per run.
//
// 2. Extending the utility prefixes: `ARBITRARY_VALUE_UTILITY` matches
//    any `<prefix>-[…]`. If the project has a sanctioned bracket use (a
//    grid template, an animation keyframe reference), narrow the pattern
//    to the prefixes you care about rather than adding a suppression
//    convention.
//
// 3. `TOKEN_SOURCE` — the framework config that DEFINES the scale and the
//    theme mapping. It has to name the raw values, so it MUST be exempt.
//    Point it at the project's `tailwind.config.ts` (or the equivalent
//    theme module).
//
// 4. Where this rule cannot see: a class assembled at runtime
//    (`` cn(`text-${size}`) ``) has no static text to read, so it passes.
//    Constrain those at the source: a helper taking a closed union of
//    size names cannot produce an off-scale class in the first place.
//    That is the type tier doing what the lint tier structurally cannot.
//
// 5. Registration: add the rule to the project's oxlint plugin
//    (`rules: { "no-arbitrary-class-values": noArbitraryClassValuesRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-arbitrary-class-values": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

// `p-[7px]`, `text-[13px]`, `bg-[#fff]` — the arbitrary-value bracket syntax carrying a literal
// length, percentage, or color. A `md:` / `hover:` variant prefix sits before the match and does
// not interfere.
const ARBITRARY_VALUE_UTILITY = /\b[a-z-]+-\[[^\]]*(?:px|rem|em|%|#[0-9a-fA-F]{3,8})[^\]]*\]/;

// `bg-[var(--background)]` — a token reached around the theme mapping.
const ARBITRARY_VAR_UTILITY =
  /\b(?:bg|text|border|outline|ring|fill|stroke|divide|from|via|to)-\[var\(--/;

// `text-sm`, `text-2xl` — the framework's generic type scale competing with the project's
// semantic one.
const GENERIC_SCALE_UTILITY = /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/;

const TOKEN_SOURCE = /\/tailwind\.config\.[tj]s$/;

// Ordered, so a string carrying more than one off-token shape reports them in a stable order.
const OFF_TOKEN_PATTERNS = [
  { pattern: ARBITRARY_VALUE_UTILITY, messageId: "arbitraryValue" },
  { pattern: ARBITRARY_VAR_UTILITY, messageId: "arbitraryVar" },
  { pattern: GENERIC_SCALE_UTILITY, messageId: "genericScale" },
] as const;

export const noArbitraryClassValuesRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      arbitraryValue:
        "Arbitrary-value utility class. Use a semantic token class instead (text-body not text-[13px], p-m not p-[12px], bg-surface not bg-[#0a0c10]). If no token fits, add one to the theme — the bracket syntax is a blank cheque no compiler reads. See docs/architecture/design-system.md.",
      arbitraryVar:
        "CSS variable reached through arbitrary-value syntax. Register the token in the theme and use the mapped class (bg-background, not bg-[var(--background)]) so the token has one definition and the checker can see it. See docs/architecture/design-system.md.",
      genericScale:
        "Generic type-scale class. Use the project's semantic type class instead (text-body, text-caption, text-section-title) so type has one vocabulary rather than two competing ones. See docs/architecture/design-system.md.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename) || TOKEN_SOURCE.test(filename)) return {};

    const reportOffTokenClasses = (node: ESTree.Node, text: string) => {
      for (const { pattern, messageId } of OFF_TOKEN_PATTERNS) {
        if (pattern.test(text)) context.report({ node, messageId });
      }
    };

    return {
      // Every string in the file, not just `className=` — classes are routinely held in a const,
      // an array, a `cn()` argument, or the branches of a ternary, and each of those is the same
      // untyped surface. The patterns describe class SHAPES specific enough that prose does not
      // trip them.
      Literal(node) {
        if (typeof node.value !== "string") return;
        reportOffTokenClasses(node, node.value);
      },

      // The static segments of a template literal. `` cn(`p-m ${extra} text-[13px]`) `` carries a
      // literal off-token class in a node type a string-literal scan never visits — the
      // interpolation makes the string dynamic, not the parts around it.
      TemplateElement(node) {
        const text = node.value.cooked ?? node.value.raw;
        reportOffTokenClasses(node, text);
      },
    };
  },
});
