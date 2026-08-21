import { describeRule } from "../lib/rule-spec.ts";
import { propCountRule } from "./prop-count.ts";

const UI = "/repo/src/features/alpha/ui/panel.tsx";
const UI_JSX = "/repo/src/features/alpha/ui/panel.jsx";
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
      // The other floor, and its wording is the difference: this one CAN name what it could not
      // read, and telling the reader to go and open `ViewProps` is the whole value of the report.
      errors: [
        {
          message:
            "WideImported has at least 8 props (threshold: 8). That is a floor: this rule could not read ViewProps out of this file, and it resolves a base type by name within one file, so the real surface is wider. Decompose into smaller components, group props that always travel together into one object, or lift shared data into context.",
        },
      ],
    },
    {
      name: "the annotation sits on a parameter that carries a default",
      filename: UI,
      // `props: P = {…}` wraps the parameter in an AssignmentPattern, and the annotation moves one
      // node in with it. A rule reading `parameter.typeAnnotation` off an Identifier or an
      // ObjectPattern finds nothing here — and then finds no destructure either, so the component
      // has no props at all to this rule while react/hook-count and react/single-component-export
      // both see it perfectly well.
      code: `interface DefaultedPanelProps {
  title: string;
  subtitle: string;
  tone: string;
  size: string;
  variant: string;
  icon: string;
  dense: boolean;
  onDismiss: () => void;
}

export function DefaultedPanel(props: DefaultedPanelProps = DEFAULT_PANEL_PROPS) {
  return <section data-tone={props.tone}>{props.title}</section>;
}`,
      errors: [{ messageId: "tooManyProps" }],
    },
    {
      name: "a destructure carrying a default, two quoted keys, and one key the rule cannot read",
      filename: UI,
      // Three separate ways to lose this component's props, in the order they bite. The default
      // wraps the pattern in an AssignmentPattern, so a reader keyed on ObjectPattern finds no
      // props at all. `["dense"]` is the same prop as `dense` and dropping the two scores six,
      // which reads as a component under the line. And `[dynamicKey]` names a prop nobody can
      // follow, so eight is a floor rather than the surface — the confident wording here would be
      // a number the rule had already decided was incomplete.
      code: `export function DefaultedDestructure({
  title,
  subtitle,
  tone,
  size,
  variant,
  icon,
  ["dense"]: dense,
  ["onDismiss"]: onDismiss,
  [dynamicKey]: extra,
} = {}) {
  return <section data-tone={tone} data-extra={extra} data-dense={dense} onClick={onDismiss}>{title}</section>;
}`,
      errors: [{ messageId: "tooManyPropsFloorUnreadable" }],
    },
    {
      name: "two of the eight members are keyed by a quoted string rather than a name",
      filename: UI,
      // `{ ["dense"]: boolean }` is the same member as `dense: boolean` — one owner answers "what
      // key is this", and every other consumer in the catalog already asks it. Dropping the two
      // computed members scores six and goes silent, which reads as a component under the line.
      code: `export function QuotedKeyPanel(props: {
  title: string;
  subtitle: string;
  tone: string;
  size: string;
  variant: string;
  icon: string;
  ["dense"]: boolean;
  ["onDismiss"]: () => void;
}) {
  return <section data-tone={props.tone}>{props.title}</section>;
}`,
      errors: [{ messageId: "tooManyProps" }],
    },
    {
      name: "a member keyed by an expression makes the count a floor rather than a silence",
      filename: UI,
      // Eight readable names and one that names nothing this rule can follow. The count is right
      // and the surface is wider than the count, which is exactly what the floor wording says —
      // and reporting the confident wording here would be a number the rule had already decided
      // was incomplete.
      code: `export function ExpressionKeyPanel(props: {
  title: string;
  subtitle: string;
  tone: string;
  size: string;
  variant: string;
  icon: string;
  dense: boolean;
  onDismiss: () => void;
  [dynamicKey]: string;
}) {
  return <section data-tone={props.tone}>{props.title}</section>;
}`,
      // The TEXT, not just the id: this floor names no base type, because there is no base to go
      // and open. The other floor message's instruction — read `{{bases}}` out of another file —
      // would send the reader looking for something this file does not have.
      errors: [
        {
          message:
            "ExpressionKeyPanel has at least 8 props (threshold: 8). That is a floor: part of its props type declares no name this rule can read \u2014 a computed key, a union of prop shapes, or an index signature \u2014 so the real surface is wider. Decompose into smaller components, group props that always travel together into one object, or lift shared data into context.",
        },
      ],
    },
    {
      name: "eight destructured props in a .jsx file",
      filename: UI_JSX,
      // The extension, not the syntax. A `.jsx` component declares props exactly as a `.tsx` one
      // does, and there is no annotation to read in either.
      code: `export function PlainWidePanel({
  title,
  subtitle,
  tone,
  size,
  variant,
  icon,
  dense,
  onDismiss,
}) {
  return <section data-tone={tone}>{title}</section>;
}`,
      errors: [{ messageId: "tooManyProps" }],
    },
    {
      name: "four props, against a threshold of 4 set in the project's config",
      filename: UI,
      options: [{ threshold: 4 }],
      // The option, proved in the direction that cannot pass by accident. Four props is silent at
      // the default of 8, so this fires only if the configured value reached the comparison — a
      // rule that ignored `options` reports nothing here and looks exactly like one that works.
      code: `interface ConfiguredRowProps {
  rowId: string;
  label: string;
  tone: "info" | "warn";
  onOpen: (id: string) => void;
}

export function ConfiguredRow(props: ConfiguredRowProps) {
  return <div data-tone={props.tone}>{props.label}</div>;
}`,
      errors: [{ messageId: "tooManyProps" }],
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
    {
      name: "a rest parameter declares an argument list, which is not a props surface",
      filename: UI,
      // The negative space this rule states, held in both its spellings. `...props: [WideRestProps]`
      // annotates a TUPLE, and `...{ … }` destructures the ARGUMENTS ARRAY — whose keys are `0`,
      // `1` and `length`, not the caller's object. Following either one hands the count a set of
      // names that are not the component's props, so the rule says nothing about these two rather
      // than something wrong.
      code: `interface WideRestProps {
  title: string;
  subtitle: string;
  tone: string;
  size: string;
  variant: string;
  icon: string;
  dense: boolean;
  onDismiss: () => void;
}

export function TupleRestPanel(...props: [WideRestProps]) {
  return <section data-tone={props[0].tone}>{props[0].title}</section>;
}

export function DestructuredRestPanel(...{
  title,
  subtitle,
  tone,
  size,
  variant,
  icon,
  dense,
  onDismiss,
}) {
  return <section data-tone={tone}>{title}</section>;
}`,
    },
    {
      name: "eight props, against a threshold of 9 set in the project's config",
      filename: SHARED,
      options: [{ threshold: 9 }],
      // The other direction, and the case the rule's own message promises: a design-system
      // primitive whose wide surface is deliberate raises the threshold and goes quiet. Eight
      // fires at the default, so a raised value that never reached the comparison fails here.
      code: `interface RaisedThresholdProps {
  title: string;
  subtitle: string;
  tone: string;
  size: string;
  variant: string;
  icon: string;
  dense: boolean;
  onDismiss: () => void;
}

export function RaisedThreshold(props: RaisedThresholdProps) {
  return <section data-tone={props.tone}>{props.title}</section>;
}`,
    },
  ],
});
