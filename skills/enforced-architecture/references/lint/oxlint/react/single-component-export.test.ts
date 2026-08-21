import { describeRule } from "../lib/rule-spec.ts";
import { singleComponentExportRule } from "./single-component-export.ts";

const UI = "/repo/src/features/alpha/ui/panel.tsx";
const UI_JSX = "/repo/src/features/alpha/ui/panel.jsx";
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
      name: "two components handed to one export list at the foot of the file",
      filename: UI,
      // The style this rule is least useful against and most needed for: neither declaration
      // carries `export`, so a reader that only walks exported declarations scores zero and calls
      // the file clean. Both declaration forms are here, because the export list is the one place
      // a `function` and a `const` arrive by the same node. `Card` also names a type, which oxlint
      // merges into ONE binding carrying two definitions with the interface first — so a resolver
      // that read the first definition and stopped finds a type declaration and calls this a
      // one-component file. And the list names them in the OTHER order than the file declares them,
      // so a reading that took export order would blame `CardRow` and name the pair backwards.
      code: `function CardRow({ label }: { label: string }) {
  return <li>{label}</li>;
}

interface Card {
  title: string;
}

const Card = ({ title }: Card) => <section>{title}</section>;

export { Card, CardRow };`,
      errors: [{ messageId: "multipleComponents", data: { names: "CardRow, Card" } }],
    },
    {
      name: "an export default naming a declaration made earlier in the file",
      filename: UI,
      // `export default DeferredFooter` binds no declaration of its own. The component it names is
      // three lines up and unexported at its declaration, which is the same blind spot as the
      // export list and a separate node.
      code: `export function DeferredPanel({ title }: { title: string }) {
  return <section>{title}</section>;
}

const DeferredFooter = ({ label }: { label: string }) => <footer>{label}</footer>;

export default DeferredFooter;`,
      errors: [{ messageId: "multipleComponents", data: { names: "DeferredPanel, DeferredFooter" } }],
    },
    {
      name: "the same two components in a .jsx file",
      filename: UI_JSX,
      // The extension, not the syntax. `.jsx` renders UI exactly as `.tsx` does, and a rule keyed
      // on one spelling of "this file renders" governs half a codebase and reports nothing about
      // the other half.
      code: `export const PlainCard = ({ title }) => <section>{title}</section>;

export const PlainRow = ({ label }) => <li>{label}</li>;`,
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
      name: "one component exported twice is still one component",
      filename: UI,
      // `export default Sole` beside `export { Sole }` is legal and ordinary. Counting the
      // declaration once per export that names it reports a single-component file as a pair, which
      // is the over-match that arrives with resolving export lists at all.
      code: `const SoleCard = ({ title }: { title: string }) => <section>{title}</section>;

export { SoleCard };
export default SoleCard;`,
    },
    {
      name: "a re-export in an ordinary file names a component declared elsewhere",
      filename: UI,
      // Not the barrel exemption — this path is no barrel. `export { PrimaryPanel } from "./…"`
      // binds nothing in this file, so there is nothing here to move and one component to count.
      // A resolver that matched the specifier's name against anything in scope would find the
      // import and report a file with one component in it.
      code: `export { PrimaryPanel } from "./primary-panel.tsx";
import { SharedBadge } from "./shared-badge.tsx";
export { SharedBadge };

export const OnlyLocalCard = ({ title }: { title: string }) => <section>{title}</section>;`,
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
