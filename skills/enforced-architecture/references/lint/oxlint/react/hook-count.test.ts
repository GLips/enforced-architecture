import { describeRule } from "../lib/rule-spec.ts";
import { hookCountRule } from "./hook-count.ts";

const UI = "/repo/src/features/alpha/ui/panel.tsx";
const UI_JSX = "/repo/src/features/alpha/ui/panel.jsx";
const SHARED = "/repo/src/shared/ui/panel.tsx";

describeRule("react/hook-count", hookCountRule, {
  obvious: [
    {
      name: "eight hooks, one per line, none annotated",
      filename: UI,
      // Nothing about this is clever, which is the point: a miss here is a rule that stopped
      // running rather than one that met a spelling it could not read.
      code: `export function StackedHooks({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n: number) => n + 1, 0);
  const node = useRef(null);
  const label = useMemo(() => name, [name]);
  const onOpen = useCallback(() => setOpen(true), []);
  const onShut = useCallback(() => setOpen(false), []);
  useEffect(() => setName(id), [id]);
  return <div ref={node} data-count={count} onClick={open ? onShut : onOpen}>{label}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
  ],

  adversarial: [
    {
      name: "two hooks share one line, and two more carry generic type arguments",
      filename: UI,
      // Seven, reached only if BOTH hooks on the `onOpen`/`onShut` line count and the type
      // arguments on `useState<string | null>` and `useRef<HTMLDivElement>` are tolerated. Either
      // gap alone scores six and the file goes silent — indistinguishable from a pass.
      code: `export function ManyHooks({ id }: { id: string }) {
  const [name, setName] = useState<string | null>(null);
  const node = useRef<HTMLDivElement>(null);
  const label = useMemo(() => name, [name]);
  useEffect(() => setName(id), [id]);
  const onOpen = useCallback(() => setName(id), [id]), onShut = useCallback(() => setName(null), []);
  const [open, setOpen] = useState(false);
  return <div ref={node} onClick={open ? onShut : onOpen}>{label}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "an arrow component reached through memo, with namespaced hook calls",
      filename: SHARED,
      // The subject is the function INSIDE the wrapper, and `React.useState` is the same hook as
      // `useState`. A rule reading only the binding sees a call expression and counts nothing.
      code: `export const WrappedPanel = memo(({ id }: { id: string }) => {
  const [a, setA] = React.useState(id);
  const [b, setB] = React.useState(id);
  const c = React.useMemo(() => a + b, [a, b]);
  const d = React.useRef(null);
  const e = React.useCallback(() => setA(id), [id]);
  const f = React.useCallback(() => setB(id), [id]);
  React.useEffect(() => setA(id), [id]);
  return <div ref={d} onClick={e} data-f={String(f)}>{c}</div>;
});`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "seven hooks imported under names that are not hook-shaped",
      filename: UI,
      // The hook is whatever the MODULE exported, not what this file decided to call it. Read on
      // the local spelling alone, `derive` and `bind` are ordinary function calls and this
      // component makes one hook call.
      code: `import { useState as pull, useEffect as run, useMemo as derive, useRef as slot, useCallback as bind } from "react";

export function AliasedPanel({ id }: { id: string }) {
  const [name, setName] = pull(id);
  const [open, setOpen] = pull(false);
  const label = derive(() => name, [name]);
  const node = slot(null);
  const onOpen = bind(() => setOpen(true), []);
  const onShut = bind(() => setOpen(false), []);
  run(() => setName(id), [id]);
  return <div ref={node} onClick={open ? onShut : onOpen}>{label}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "one of the seven is a default-imported custom hook, specifier spelling",
      filename: UI,
      // `{ default as usePanelState }` is a default export wearing a named specifier's node shape.
      // The name it hands over is the string "default", which is not a hook name — so a reader that
      // trusted the exported name here would drop the call and score six, while the identical
      // `import usePanelState from "./…"` still counted. One spelling, two answers.
      code: `import { default as usePanelState } from "./use-panel-state.ts";

export function DefaultImportedHookPanel({ id }: { id: string }) {
  const { open, toggle } = usePanelState(id);
  const [name, setName] = useState(id);
  const label = useMemo(() => name, [name]);
  const node = useRef(null);
  const onOpen = useCallback(() => toggle(true), [toggle]);
  const onShut = useCallback(() => toggle(false), [toggle]);
  useEffect(() => setName(id), [id]);
  return <div ref={node} onClick={open ? onShut : onOpen}>{label}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "seven hooks in a .jsx file",
      filename: UI_JSX,
      // The extension, not the syntax: a `.jsx` component is a component. Every rule in this
      // catalog governed this file already except the five keyed on rendering, which read one
      // extension out of the eight.
      code: `export function PlainPanel({ id }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n) => n + 1, 0);
  const node = useRef(null);
  const label = useMemo(() => name, [name]);
  const onOpen = useCallback(() => setOpen(true), []);
  useEffect(() => setName(id), [id]);
  return <div ref={node} data-count={count} onClick={onOpen}>{open ? label : id}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "four hooks, against a threshold of 4 set in the project's config",
      filename: UI,
      options: [{ threshold: 4 }],
      // The option, proved in the direction that cannot pass by accident. Four hooks is silent at
      // the default of 7, so this fires only if the configured value reached the comparison — a
      // rule that ignored `options` reports nothing here and looks exactly like one that works.
      code: `export function ConfiguredPanel({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const label = useMemo(() => name, [name]);
  useEffect(() => setName(id), [id]);
  return <div data-open={open} onClick={() => setOpen(true)}>{label}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
  ],

  legal: [
    {
      name: "six hooks is one under the threshold",
      filename: UI,
      // An over-count of exactly one is the likeliest arithmetic mistake, and no positive case
      // can see it.
      code: `export function SixHooksNeighbour({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const label = useMemo(() => name, [name]);
  const onOpen = useCallback(() => setOpen(true), []);
  const onShut = useCallback(() => setOpen(false), []);
  useEffect(() => setName(id), [id]);
  return <button type="button" onClick={open ? onShut : onOpen}>{label}</button>;
}`,
    },
    {
      name: "eight hook calls in the file, seven of them consolidated into a custom hook",
      filename: UI,
      // The fix this rule asks for. Counting per FILE reports it, which is the over-match that
      // teaches people the warning is noise.
      code: `export function usePanelState(id: string) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n: number) => n + 1, 0);
  const node = useRef(null);
  const label = useMemo(() => name, [name]);
  const onToggle = useCallback(() => setOpen((was) => !was), []);
  useEffect(() => setName(id), [id]);
  return { count, bump, label, node, onToggle, open };
}

export function ExtractedHookPanel({ id }: { id: string }) {
  const { count, bump, label, node, onToggle, open } = usePanelState(id);
  return <div ref={node} data-count={count} onClick={onToggle}>{open ? label : id}</div>;
}`,
    },
    {
      name: "seven calls that are hook-shaped locally and are not hooks at the module that exports them",
      filename: UI,
      // The other direction of the same decision, and the one that can only over-match. A project
      // that aliases a factory into hook clothing has not written seven hooks, and reporting it
      // would make the count something other than what the message says it is.
      code: `import { createStore as useStore, makeAtom as useAtom } from "@/shared/state";

export function AliasedFactories({ id }: { id: string }) {
  const a = useStore(id);
  const b = useStore(id);
  const c = useStore(id);
  const d = useAtom(id);
  const e = useAtom(id);
  const f = useAtom(id);
  const g = useAtom(id);
  return <div data-a={a} data-b={b} data-c={c} data-d={d} data-e={e} data-f={f}>{g}</div>;
}`,
    },
    {
      name: "seven hooks, against a threshold of 8 set in the project's config",
      filename: UI,
      options: [{ threshold: 8 }],
      // The other direction. Seven fires at the default, so a raised threshold that never reached
      // the comparison shows up as a failure here rather than as a knob nobody notices is dead.
      code: `export function RaisedThresholdPanel({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n: number) => n + 1, 0);
  const node = useRef(null);
  const label = useMemo(() => name, [name]);
  const onToggle = useCallback(() => setOpen((was) => !was), []);
  useEffect(() => setName(id), [id]);
  return <div ref={node} data-count={count} onClick={onToggle}>{open ? label : id}</div>;
}`,
    },
  ],
});
