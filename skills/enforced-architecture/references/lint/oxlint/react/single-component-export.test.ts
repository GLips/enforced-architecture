import { describeRule } from "../lib/rule-spec.ts";
import { singleComponentExportRule } from "./single-component-export.ts";

const UI = "/repo/src/features/alpha/ui/panel.tsx";
const BARREL = "/repo/src/features/alpha/ui/index.tsx";

describeRule("react/single-component-export", singleComponentExportRule, {
  obvious: [
    {
      name: "two components in one file, the second a zero-parameter arrow",
      filename: UI,
      // The arrow is the shape most likely to get tucked in beside a real component, because it
      // feels too small for its own file.
      code: `export function PrimaryPanel({ title }: { title: string }) {
  return <section><h2>{title}</h2><SecondaryBadge /></section>;
}

export const SecondaryBadge = () => <span>badge</span>;`,
      errors: [{ messageId: "multipleComponents" }],
    },
  ],

  adversarial: [
    {
      name: "an export default function beside an ordinary export function",
      filename: UI,
      // Only the `default` clause tells these two apart. A reader keyed on `export function Name`
      // finds one of them and reports nothing, which is the clean run a good file produces.
      code: `export default function DefaultPairPanel() {
  return <section><DefaultPairFooter label="done" /></section>;
}

export function DefaultPairFooter({ label }: { label: string }) {
  return <footer>{label}</footer>;
}`,
      errors: [{ messageId: "multipleComponents" }],
    },
    {
      name: "a generic component beside an arrow one",
      filename: UI,
      // `OptionList` puts its type-parameter list between the name and the paren; `OptionRow` is
      // the arrow the `function` keyword never reaches. Miss either and the file scores one.
      code: `export function OptionList<T extends string>({ items }: { items: T[] }) {
  return <ul>{items.map((item) => <OptionRow key={item} label={item} />)}</ul>;
}

export const OptionRow = ({ label }: { label: string }) => <li>{label}</li>;`,
      errors: [{ messageId: "multipleComponents" }],
    },
    {
      name: "a memo binding is a component, not an unreadable value",
      filename: UI,
      code: `export const MemoPanel = memo(function PanelImpl({ id }: { id: string }) {
  return <div>{id}</div>;
});

export const PanelRow = ({ label }: { label: string }) => <li>{label}</li>;`,
      errors: [{ messageId: "multipleComponents" }],
    },
  ],

  legal: [
    {
      name: "a genuine compound component namespaced with Object.assign",
      filename: UI,
      // BOTH halves are exported, so this file has two components and the only thing keeping the
      // rule quiet is the exemption. An earlier version of this fixture exported neither half, so
      // it scored zero and passed whether the exemption existed or not.
      code: `export function CardRoot({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function CardHeader({ title }: { title: string }) {
  return <h3>{title}</h3>;
}

export const Card = Object.assign(CardRoot, { Header: CardHeader });`,
    },
    {
      name: "one component beside three exports a name-only test would count",
      filename: UI,
      // Every one of these was a real false positive at some point. A PascalCase const is very
      // often not a component, and reporting a context or a constant is what teaches people the
      // rule is noise.
      code: `export const AlphaCtx = createContext<string | null>(null);

export const DRAG_SLOP = 4;

export type AlphaShape = { id: string };

export function AlphaPanel() {
  return <div>alpha</div>;
}`,
    },
    {
      name: "a barrel re-exports by design",
      filename: BARREL,
      code: `export { PrimaryPanel } from "./primary-panel.tsx";
export const SecondaryBadge = () => <span>badge</span>;
export const TertiaryBadge = () => <span>badge</span>;`,
    },
  ],
});
