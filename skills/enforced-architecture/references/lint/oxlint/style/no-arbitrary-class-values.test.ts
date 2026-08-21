import { describeRule } from "../lib/rule-spec.ts";
import { noArbitraryClassValuesRule } from "./no-arbitrary-class-values.ts";

const COMPONENT = "/repo/src/features/billing/ui/panel.tsx";

describeRule("style/no-arbitrary-class-values", noArbitraryClassValuesRule, {
  obvious: [
    {
      name: "a bracket class carrying a raw pixel value",
      filename: COMPONENT,
      code: `export const Panel = () => <div className="p-[12px]" />;`,
      errors: [{ messageId: "arbitraryValue" }],
    },
    {
      name: "a token reached around the theme mapping",
      filename: COMPONENT,
      code: `export const Var = () => <div className="bg-[var(--background)]" />;`,
      errors: [{ messageId: "arbitraryVar" }],
    },
    {
      name: "the framework's generic type scale competing with the semantic one",
      filename: COMPONENT,
      code: `export const Scale = () => <div className="text-sm font-medium" />;`,
      errors: [{ messageId: "genericScale" }],
    },
  ],

  adversarial: [
    {
      name: "a single-quoted string is the same string",
      filename: COMPONENT,
      code: `export const Cell = () => <div className='bg-[#0a0c10]' />;`,
      errors: [{ messageId: "arbitraryValue" }],
    },
    {
      name: "one off-token class buried among legal ones still reports",
      filename: COMPONENT,
      code: `export const Head = () => <div className="flex items-center gap-m rounded-lg border-[2px] p-m" />;`,
      errors: [{ messageId: "arbitraryValue" }],
    },
    {
      name: "three off-token shapes in one string report three times, not once",
      filename: COMPONENT,
      code: `export const All = () => <div className="text-[13px] bg-[var(--background)] text-sm" />;`,
      errors: [
        { messageId: "arbitraryValue" },
        { messageId: "arbitraryVar" },
        { messageId: "genericScale" },
      ],
    },
    {
      name: "a token name containing 'em' is still one finding, not the value arm's as well",
      filename: COMPONENT,
      code: `export const Card = () => <div className="bg-[var(--theme-surface)]" />;`,
      errors: [{ messageId: "arbitraryVar" }],
    },
    {
      name: "a var with a literal fallback has both defects, so it draws both arms rather than one",
      filename: COMPONENT,
      code: `export const Split = () => <div className="bg-[var(--surface,#0a0c10)]" />;`,
      errors: [{ messageId: "arbitraryValue" }, { messageId: "arbitraryVar" }],
    },
    {
      name: "a template literal's static segment is class text a string scan never visits",
      filename: COMPONENT,
      code: "export const cls = (extra: string) => `p-m ${extra} text-[13px]`;",
      errors: [{ messageId: "arbitraryValue" }],
    },
    {
      name: "a conditional className puts the class in a branch rather than the attribute",
      filename: COMPONENT,
      code: `export const Row = ({ open }: { open: boolean }) => <div className={open ? "text-[13px]" : "text-body"} />;`,
      errors: [{ messageId: "arbitraryValue" }],
    },
    {
      name: "a class held in a const array is nowhere near a className attribute",
      filename: COMPONENT,
      code: `export const CLASSES = ["bg-surface", "text-2xl"];`,
      errors: [{ messageId: "genericScale" }],
    },
    {
      name: "a directory that merely starts like the non-UI layer is not exempt",
      filename: "/repo/src/domains-legacy/pricing/palette.ts",
      code: `export const badge = "text-[13px]";`,
      errors: [{ messageId: "arbitraryValue" }],
    },
    {
      // The colour half of the bracket, which this rule owns OUTRIGHT — `style/no-inline-color`
      // is silent on both of these, because its own message prescribes `var(--…)` and writing
      // that into a bracket draws `arbitraryVar` instead. The message is asserted rather than the
      // id: it is the only one of the three that names a terminating fix for a colour, and it is
      // now the only message an adopter sees for this input.
      //
      // The rgb spelling is the one a hex-only pattern misses, and it is the reason both rules
      // read `lib/color-literals.ts` rather than each holding a hex.
      name: "a colour in a bracket, hex and rgb alike, is this rule's alone",
      filename: COMPONENT,
      code: `export const s = { a: "bg-[#0a0c10]", b: "text-[rgb(10,12,16)]" };`,
      errors: [
        {
          message:
            "Arbitrary-value utility class. Use a semantic token class instead (text-body not text-[13px], p-m not p-[12px], bg-surface not bg-[#0a0c10]). If no token fits, add one to the theme — the bracket syntax is a blank cheque no compiler reads. See docs/architecture/design-system.md.",
        },
        { messageId: "arbitraryValue" },
      ],
    },
    {
      // The token source is the tree's named theme module, not any file called
      // theme-something. A path-suffix exemption would hand every neighbour the
      // permission to define a second scale.
      name: "a module beside the token source does not inherit its permission",
      filename: "/repo/src/shared/ui/theme-legacy.ts",
      code: `export const safelist = ["text-[13px]"];`,
      errors: [{ messageId: "arbitraryValue" }],
    },
  ],

  legal: [
    {
      // The gate this rule did NOT have while its two siblings did. A domain
      // cannot import a primitive, so a utility class there is a placement
      // problem that placement/topology and boundary/import-policy report; a
      // styling diagnostic on top of theirs prescribes a token where the fix is
      // to move the file.
      name: "a non-UI layer is exempt because it should carry no styling at all",
      filename: "/repo/src/domains/pricing/rules.ts",
      code: `export const badge = "text-[13px]";`,
    },
    {
      // The other gate this rule gained. The theme module maps the tokens, so
      // the raw scale steps it writes are the definition the rest of the tree is
      // told to name.
      name: "the token source has to write the scale the tokens resolve to",
      filename: "/repo/src/shared/ui/theme.ts",
      code: `export const safelist = ["text-[13px]", "text-sm"];`,
    },
    {
      name: "the semantic token classes the rule points people to",
      filename: COMPONENT,
      code: `export const Badge = () => <div className="text-body bg-surface p-m gap-s rounded-lg flex items-center" />;`,
    },
    {
      // NEGATIVE SPACE, stated in the header and pinned here: `COLOR_LITERAL`'s word boundary ends
      // the hex at eight digits, so a longer run is not a colour to either style rule. The
      // boundary is what stops `"#abcdef123"` — an anchor, a sha — reading as one in a plain
      // string value, and it is worth more than a notation nothing renders.
      name: "more than eight hex digits is not a colour in any notation",
      filename: COMPONENT,
      code: `export const s = "bg-[#0123456789]";`,
    },
    {
      name: "a bracket class with no unit and no hex is an arbitrary variant, not a raw value",
      filename: COMPONENT,
      code: `export const Peer = () => <div className="group-[.is-open]:block" />;`,
    },
    {
      name: "an arbitrary VARIANT whose selector contains a unit's letters — 'item' ends in 'em'",
      filename: COMPONENT,
      code: `export const List = () => <div className="has-[.item]:block data-[theme=dark]:flex" />;`,
    },
    {
      name: "a semantic class that merely starts like a generic scale step",
      filename: COMPONENT,
      code: `export const Near = () => <div className="text-small text-body-lg" />;`,
    },
    {
      name: "a runtime-assembled class has no static text to read",
      filename: COMPONENT,
      code: "export const cls = (size: string) => `text-${size}`;",
    },
    {
      name: "a raw hex outside bracket syntax is another rule's business",
      filename: COMPONENT,
      code: `export const brand = "#0a0c10";`,
    },
    {
      name: "the theme config defines the scale, so it must be able to name it",
      filename: "/repo/tailwind.config.ts",
      code: `export const safelist = ["text-[13px]", "text-sm"];`,
    },
    {
      name: "a test file may assert on the class it is testing",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: `export const expected = "p-[12px]";`,
    },
    {
      name: "a one-off script is not shipped UI",
      filename: "/repo/scripts/audit-classes.ts",
      code: `export const suspect = "text-[13px]";`,
    },
  ],
});
