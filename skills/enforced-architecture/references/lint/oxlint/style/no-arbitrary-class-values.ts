// ─── style/no-arbitrary-class-values ──────────────────────────────────
//
// Makes sure: A utility class names a semantic token. No `text-[13px]`, no
// `bg-[#0a0c10]`, no `bg-[var(--background)]`, and no step of the framework's
// own scale such as `text-sm`. To change the body size or the surface color,
// you edit the theme config once, and every class that names the token follows.
//
// The framework's theme config — `tailwind.config.ts` — writes the raw values
// the tokens resolve to, and needs no exemption here: it sits at the project
// root, outside every declared tree, so this rule is already silent there. A
// project that moves it INSIDE a declared tree has to name it in that tree's
// `themeModule`, which is the exemption this rule reads.
//
// The domain layer is skipped because it carries no presentation, and the token
// source is skipped because it defines what everything else names. Both are
// `isStyleSubject` in lint/policy/layout.ts, which the whole style tier calls —
// these three rules and style/token-equality. A domain cannot import a
// primitive at all, so a utility class in one is a placement problem that
// placement/topology and boundary/import-policy report; a styling diagnostic on
// top of theirs would prescribe a token where the fix is to move the file.
//
// Add GENERIC_SCALE_UTILITY only after the semantic type classes exist
// (`text-body`, `text-caption`). Before that, an agent has a banned class and
// no allowed one, and it writes `text-[13px]` instead.
//
// A class built at run time (`` cn(`text-${size}`) ``) has no static text, and
// this rule passes it. Fix that at the type tier: a helper that takes a
// closed union of size names cannot produce an off-scale class.
//
// If the project has one sanctioned bracket use — a grid template, an animation
// keyframe — narrow ARBITRARY_VALUE_UTILITY to the prefixes you mean. Do not
// add a suppression convention: it exempts every prefix at once.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import { isStyleSubject } from "../../policy/layout.ts";

// `p-[7px]`, `text-[13px]`, `bg-[#fff]` — the arbitrary-value bracket syntax carrying a literal
// length, percentage, or color. A `md:` / `hover:` variant prefix sits before the match and does
// not interfere.
//
// The `\d` in front of the unit alternation is what makes this a VALUE match rather than a letter
// match, and it is the only thing keeping the arm off arbitraryVar's class. Drop it and `em` matches
// those two letters wherever they land, which is inside ordinary words: `has-[.item]:block`,
// `data-[theme=dark]:flex` and `input-[type=email]` are all real Tailwind and all report as raw
// values, and `bg-[var(--theme-surface)]` reports twice — once here and once as arbitraryVar — for
// one class with one fix. A unit with no number in front of it is not a value.
//
// A bracket holding BOTH a var and a literal — `bg-[var(--surface,#0a0c10)]`, a token with a raw
// fallback — does draw both arms, and that is right rather than a leak: it has both defects, the two
// messages name different halves of it, and doing what either one says leaves the other still true.
//
// NEGATIVE SPACE, both directions, and the unit list is the whole of it. Only `px`, `rem`, `em` and
// `%` are units here, so `h-[100vh]`, `w-[2ch]` and `m-[10pt]` carry raw values and pass — extend
// the alternation if the project writes those. And a real value inside an arbitrary VARIANT rather
// than an arbitrary value (`data-[size=2em]:flex`) reports, because nothing in a class string
// distinguishes the two; it is rarer than what the digit closes, and it is the residue.
const ARBITRARY_VALUE_UTILITY =
  /\b[a-z-]+-\[[^\]]*(?:\d(?:px|rem|em|%)|#[0-9a-fA-F]{3,8})[^\]]*\]/;

// `bg-[var(--background)]` — a token reached around the theme mapping.
const ARBITRARY_VAR_UTILITY =
  /\b(?:bg|text|border|outline|ring|fill|stroke|divide|from|via|to)-\[var\(--/;

// `text-sm`, `text-2xl` — the framework's generic type scale competing with the project's
// semantic one.
const GENERIC_SCALE_UTILITY = /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/;

// Ordered, so a string carrying more than one off-token shape reports them in a stable order.
const OFF_TOKEN_PATTERNS = [
  { pattern: ARBITRARY_VALUE_UTILITY, messageId: "arbitraryValue" },
  { pattern: ARBITRARY_VAR_UTILITY, messageId: "arbitraryVar" },
  { pattern: GENERIC_SCALE_UTILITY, messageId: "genericScale" },
] as const;

export const noArbitraryClassValuesRule = defineTreeRule({
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
  create(context, role) {
    // Two gates, one owner. `isStyleSubject` is what the whole style tier —
    // these three rules and style/token-equality — asks before reading a line,
    // and it is one function rather than four copies because the copies
    // disagreed: two of these rules had the domain gate, one did not. The token
    // source is a named MODULE in the tree's vocabulary rather than a path
    // suffix, so a `legacy-theme.ts` beside it does not inherit the exemption.
    if (!isStyleSubject(role.tree.vocabulary, role.sourcePath)) return {};

    const reportOffTokenClasses = (node: ESTree.Node, text: string) => {
      for (const { pattern, messageId } of OFF_TOKEN_PATTERNS) {
        if (pattern.test(text)) context.report({ node, messageId });
      }
    };

    return {
      // Every string in the file, not just `className=` — classes are routinely held in a const,
      // an array, a `cn()` argument, a `cva`/`tv`/`clsx` table, or the branches of a ternary, and
      // each of those is the same untyped surface. Scoping the visitor to `className` and `cn()`
      // would reopen all of them, and would make two of this rule's own adversarial cases legal.
      //
      // NEGATIVE SPACE — what the recall costs, and it is not zero. A string that merely LOOKS like
      // an off-token class is reported wherever it sits, prose included. Measured over this
      // catalog's own `lint/` tree — ~13k lines of non-test TypeScript, comment-dense, the worst
      // case for a shape match — the count is TWO, and both are in the `messages` block above,
      // where this rule quotes `text-[13px]` and `bg-[var(--background)]` as the examples it tells
      // people not to write. The rule reports on itself, and an adopter who copies it into a linted
      // tree gets both on day one; suppress those two lines where they sit. Two
      // findings in the most hostile input available is what catching the const, the array and the
      // `cva` table costs, and it is the right trade.
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
