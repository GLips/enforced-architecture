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
  ],

  legal: [
    {
      name: "the semantic token classes the rule points people to",
      filename: COMPONENT,
      code: `export const Badge = () => <div className="text-body bg-surface p-m gap-s rounded-lg flex items-center" />;`,
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
