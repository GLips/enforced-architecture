import { describeRule } from "../lib/rule-spec.ts";
import { hookCountRule } from "./hook-count.ts";

const UI = "/repo/src/features/alpha/ui/panel.tsx";
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
