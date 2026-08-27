import { describeRule } from "../lib/rule-spec.ts";
import { returnWidthRule } from "./return-width.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";
const UI = "/repo/src/features/billing/ui/use-invoice-actions.ts";

/**
 * The one thing these fixtures need that cannot be written by hand: a body long enough to clear the
 * default 150-line threshold. Generated rather than pasted, so the LENGTH is a number in the spec
 * that a reader can compare against the default instead of a wall nobody counts.
 */
const bodyOf = (statements: number) =>
  Array.from({ length: statements }, (_, index) => `  const step${index} = ${index};`).join("\n");

/**
 * The same twelve members as an object spread over 160 lines, for the concise-arrow case: each one
 * wrapped in a call whose arguments take a dozen lines, which is what an actions object looks like
 * once every handler carries a label and a policy.
 */
const WIDE_ARROW_BODY = `{
${Array.from(
  { length: 12 },
  (_, index) => `  action${index}: withTracking(deps, {
    key: "action${index}",
    label: "Action ${index}",
    icon: "icon-${index}",
    confirm: false,
    undoable: true,
    optimistic: true,
    surface: "inbox",
    order: ${index},
    hidden: false,
    group: "row",
    shortcut: "${index}",
  }),`,
).join("\n")}
}`;

/** Twelve members, over the default of ten. */
const TWELVE_MEMBERS = `{
    accept, reject, defer, snooze, archive, restore,
    assign, unassign, tag, untag, refresh, reset,
  }`;

describeRule("health/return-width", returnWidthRule, {
  obvious: [
    {
      // 160 lines and twelve members: the two numbers the rule is named for, both over the default.
      name: "a long hook returning twelve members",
      filename: UI,
      code: `export function useInvoiceActions(): InvoiceActions {
${bodyOf(155)}
  return ${TWELVE_MEMBERS};
}`,
      errors: [{ messageId: "wideReturnFromLongBody" }],
    },
  ],

  adversarial: [
    {
      // `as const` and `satisfies` are how a wide surface gets its type, so reading the bare literal
      // makes the annotation a way to disappear from the count — reached for by an author who was
      // only narrowing a type.
      name: "the wide return behind a satisfies clause",
      filename: UI,
      code: `export function useInvoiceActions(): InvoiceActions {
${bodyOf(155)}
  return ${TWELVE_MEMBERS} satisfies InvoiceActions;
}`,
      errors: [{ messageId: "wideReturnFromLongBody" }],
    },
    {
      // The wide return is neither the first `return` nor the last, and it is not at the top level
      // of the body. Both obvious ways to ask "what does this hand back" — read the first, read the
      // last — find a three-member early exit and report nothing. The answer is the WIDEST.
      name: "the wide return between two narrow ones",
      filename: UI,
      code: `export function useInvoiceActions(ready: boolean, loading: boolean): InvoiceActions {
  if (!ready) return { accept, reject, refresh };
${bodyOf(155)}
  if (loading) {
    return ${TWELVE_MEMBERS};
  }
  return { accept, reject, refresh };
}`,
      errors: [{ messageId: "wideReturnFromLongBody" }],
    },
    {
      // No `return` statement anywhere: a concise arrow body IS what the function hands back, and a
      // walk looking for `ReturnStatement` finds nothing in it. Long AND wide all the same — this
      // is what an actions object built from wrapped handlers looks like.
      name: "a concise arrow body, which has no return statement to find",
      filename: UI,
      code: `export const useInvoiceActions = (deps: Deps) => (${WIDE_ARROW_BODY});`,
      errors: [{ messageId: "wideReturnFromLongBody" }],
    },
    {
      // Each knob is a number, and each is proved here rather than only in `legal` — a `minLines`
      // read but never compared, or a `minMembers` read but never compared, fails one of these two.
      name: "a short function under a lowered line threshold",
      filename: UI,
      code: `export function useInvoiceActions(): InvoiceActions {
${bodyOf(8)}
  return ${TWELVE_MEMBERS};
}`,
      options: [{ minLines: 10 }],
      errors: [{ messageId: "wideReturnFromLongBody" }],
    },
    {
      name: "a narrow return under a lowered member threshold",
      filename: UI,
      code: `export function useInvoiceActions(): InvoiceActions {
${bodyOf(155)}
  return { accept, reject, refresh };
}`,
      options: [{ minMembers: 3 }],
      errors: [{ messageId: "wideReturnFromLongBody" }],
    },
  ],

  legal: [
    {
      // The case that makes this rule different from one counting members alone, and the reason it
      // takes two numbers. Twenty-four members from twelve lines is a MAPPING — a token table, a row
      // marshaller, a parsed-options record — and it is exactly the right shape. The widest return
      // in the codebase these thresholds were measured against is one of these.
      name: "a token map returning twenty-four members from a dozen lines",
      filename: SERVICE,
      code: `export function tokensToVars(theme: Theme): Vars {
  return {
    bg: theme.bg, fg: theme.fg, muted: theme.muted, accent: theme.accent,
    border: theme.border, ring: theme.ring, shadow: theme.shadow, overlay: theme.overlay,
    ok: theme.ok, warn: theme.warn, danger: theme.danger, info: theme.info,
    bgAlt: theme.bgAlt, fgAlt: theme.fgAlt, mutedAlt: theme.mutedAlt, accentAlt: theme.accentAlt,
    borderAlt: theme.borderAlt, ringAlt: theme.ringAlt, shadowAlt: theme.shadowAlt,
    overlayAlt: theme.overlayAlt, okAlt: theme.okAlt, warnAlt: theme.warnAlt,
    dangerAlt: theme.dangerAlt, infoAlt: theme.infoAlt,
  };
}`,
    },
    {
      // Length on its own belongs to `health/cognitive-complexity` and `health/accumulator-count`,
      // which measure it from two other angles. A long function handing back one value is not this
      // rule's finding, and reporting it here would be a third rule speaking to the same edge.
      name: "a long function returning a single value",
      filename: SERVICE,
      code: `export function priceInvoice(invoice: Invoice): number {
${bodyOf(155)}
  return step0 + step1;
}`,
    },
    {
      // A `return` belongs to the innermost function around it. Follow the walk through the callback
      // and this long function reports twelve members it never returns — and the edit the message
      // asks for cannot be made, because there is nothing wide to split.
      name: "a wide object returned from a callback inside a long function",
      filename: UI,
      code: `export function useInvoiceRows(invoices: Invoice[]): Row[] {
${bodyOf(155)}
  return invoices.map((invoice) => {
    return ${TWELVE_MEMBERS};
  });
}`,
    },
    {
      // The thresholds are the adaptation. A project whose hooks are legitimately this shape raises
      // one of the two in one visible place, rather than exempting the function that grew.
      name: "the long wide hook under a raised member threshold",
      filename: UI,
      code: `export function useInvoiceActions(): InvoiceActions {
${bodyOf(155)}
  return ${TWELVE_MEMBERS};
}`,
      options: [{ minMembers: 20 }],
    },
    {
      name: "a test file is not a subject",
      filename: "/repo/src/features/billing/ui/use-invoice-actions.test.ts",
      code: `export function useInvoiceActions(): InvoiceActions {
${bodyOf(155)}
  return ${TWELVE_MEMBERS};
}`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `export function backfillActions(): InvoiceActions {
${bodyOf(155)}
  return ${TWELVE_MEMBERS};
}`,
    },
  ],
});
