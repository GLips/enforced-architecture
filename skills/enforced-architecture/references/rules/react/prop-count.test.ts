import { describeRule } from "../lib/rule-spec.ts";
import { propCountRule } from "./prop-count.ts";

const UI = "/repo/src/features/alpha/ui/panel.tsx";
const SHARED = "/repo/src/shared/ui/panel.tsx";

describeRule("react/prop-count", propCountRule, {
  obvious: [
    {
      name: "eight props, one per line, in a named Props interface",
      filename: SHARED,
      // The plainest shape that can fire, at the threshold rather than past it so an off-by-one in
      // the comparison shows up here too.
      code: `interface WidePlainProps {
  title: string;
  subtitle: string;
  tone: string;
  size: string;
  variant: string;
  icon: string;
  dense: boolean;
  onDismiss: () => void;
}

export function WidePlain(props: WidePlainProps) {
  return <section data-tone={props.tone}>{props.title}</section>;
}`,
      errors: [{ messageId: "tooManyProps" }],
    },
  ],

  adversarial: [
    {
      name: "nine props on a generic component with a multi-line inline type literal",
      filename: UI,
      // The destructure repeats every name the annotation declares. Counting both halves scores
      // eighteen; counting the annotation alone scores nine.
      code: `export function WideGeneric<T extends string>({
  items,
  selected,
  label,
  onSelect,
  onClear,
  onRetry,
  columns,
  dense,
  emptyText,
}: {
  items: T[];
  selected: T | null;
  label: string;
  onSelect: (item: T) => void;
  onClear: () => void;
  onRetry: () => void;
  columns: Map<string, number>;
  dense?: boolean;
  emptyText?: string;
}) {
  return <div data-dense={dense} data-columns={columns.size}>{label}</div>;
}`,
      errors: [{ messageId: "tooManyProps" }],
    },
    {
      name: "a generic named interface on a component that takes props whole",
      filename: UI,
      // Nothing to destructure here, so a destructure-only reading scores zero and stays quiet.
      // `render(): JSX.Element` is a METHOD signature, which declares the same surface as an
      // arrow-typed member and must count the same.
      code: `interface WideTypedProps<Id extends string> {
  rowId: Id;
  onOpen: (id: Id) => void;
  onClose: (id: Id) => void;
  onRename: (id: Id, name: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  render(): JSX.Element;
  columns: Map<string, number>;
  dense?: boolean;
}

export function WideTyped(props: WideTypedProps<string>) {
  return <div data-dense={props.dense}>{props.rowId}</div>;
}`,
      errors: [{ messageId: "tooManyProps" }],
    },
    {
      name: "seven of the eight props are declared left of the brace, as an intersection",
      filename: UI,
      // The spelling a component reaches for once its surface is wide. A reader that took only the
      // members written beside the component scores one and says nothing.
      code: `type WideIntersectionModel = {
  headline: string;
  summary: string;
  tone: "info" | "warn";
  rows: readonly string[];
  steps: readonly string[];
  notes: readonly string[];
  imageUri: string | undefined;
};

type WideIntersectionProps = WideIntersectionModel & {
  onScanAnother: () => void;
};

export function WideIntersection(props: WideIntersectionProps) {
  return <section data-tone={props.tone}>{props.headline}</section>;
}`,
      errors: [{ messageId: "tooManyProps" }],
    },
    {
      name: "the same blind spot through extends, with two bases in the clause",
      filename: UI,
      // `extends A, B` is a comma list, and resolving "the base" rather than every entry scores
      // five here — still under the line, still silent, and passing the intersection case.
      code: `interface WideExtendsIdentity {
  rowId: string;
  label: string;
  tone: "info" | "warn";
}

interface WideExtendsLayout {
  columns: number;
  dense: boolean;
  gutter: number;
}

interface WideExtendsProps extends WideExtendsIdentity, WideExtendsLayout {
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
}

export function WideExtends(props: WideExtendsProps) {
  return <div data-tone={props.tone}>{props.label}</div>;
}`,
      errors: [{ messageId: "tooManyProps" }],
    },
    {
      name: "a base declared in another file makes the count a floor, not a silence",
      filename: SHARED,
      // Eight own props plus whatever `ViewProps` carries. The rule has no type checker, so it
      // reports what it can see and says the number is a floor.
      code: `interface WideImportedProps extends ViewProps {
  title: string;
  subtitle: string;
  tone: string;
  size: string;
  variant: string;
  icon: string;
  dense: boolean;
  onDismiss: () => void;
}

export function WideImported(props: WideImportedProps) {
  return <section data-tone={props.tone}>{props.title}</section>;
}`,
      errors: [{ messageId: "tooManyPropsFloor" }],
    },
  ],

  legal: [
    {
      name: "seven props through a destructure and the inline literal that repeats them",
      filename: UI,
      // One under the line on purpose: counting both halves scores fourteen, and a three-prop
      // legal fixture would stay silent even when doubled and prove nothing. `children` and
      // `...rest` are excluded by policy.
      code: `export function NarrowNeighbour({
  title,
  onDismiss,
  tone,
  size,
  variant,
  icon,
  dense,
  children,
  ...rest
}: {
  title: string;
  onDismiss: () => void;
  tone: "info" | "warn";
  size: "sm" | "md";
  variant: string;
  icon: string;
  dense: boolean;
  children: React.ReactNode;
}) {
  return <section {...rest} data-tone={tone}>{children}</section>;
}`,
    },
    {
      name: "seven through a named interface, one of them a nested object literal",
      filename: UI,
      // `layout` is ONE prop whose type is an object literal. Counting every `name:` in the body
      // rather than every top-level member reads its three fields as three more props.
      code: `interface NarrowTypedNeighbourProps {
  rowId: string;
  label: string;
  tone: "info" | "warn";
  layout: { columns: number; dense: boolean; gutter: number };
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  render: () => JSX.Element;
  children: React.ReactNode;
}

export function NarrowTypedNeighbour(props: NarrowTypedNeighbourProps) {
  return <div data-tone={props.tone}>{props.label}</div>;
}`,
    },
    {
      name: "seven across a base and the literal intersected with it",
      filename: UI,
      // The guard on the merge. `tone` is declared on both sides and is ONE prop. `model` is a
      // member whose type is a named type declared here — it must NOT expand, or the rule reports
      // the very shape it asks for: props that travel together, grouped and given a name.
      code: `type NarrowRowModel = {
  rowId: string;
  label: string;
  tone: "info" | "warn";
  layout: { columns: number; dense: boolean; gutter: number };
  render: () => JSX.Element;
};

type NarrowIntersectionNeighbourProps = NarrowRowModel & {
  tone?: "info" | "warn";
  model: NarrowRowModel;
  onOpen: (id: string) => void;
  children?: React.ReactNode;
};

export function NarrowIntersectionNeighbour(props: NarrowIntersectionNeighbourProps) {
  return <div data-tone={props.tone}>{props.model.rowId}</div>;
}`,
    },
    {
      name: "a PascalCase const bound to something that is not a component",
      filename: UI,
      // A context is not a component, and its type argument is not a prop surface. Reporting one
      // is the over-match that teaches people the rule is noise.
      code: `export const AlphaCtx = createContext<{
  a: string;
  b: string;
  c: string;
  d: string;
  e: string;
  f: string;
  g: string;
  h: string;
}>(null);`,
    },
  ],
});
