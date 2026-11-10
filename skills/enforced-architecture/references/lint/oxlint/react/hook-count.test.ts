import { describeRule } from "../lib/rule-spec.ts";
import { hookCountRule } from "./hook-count.ts";

const UI = "/repo/src/features/alpha/ui/panel.tsx";
const UI_JSX = "/repo/src/features/alpha/ui/panel.jsx";
const SHARED = "/repo/src/shared/ui/panel.tsx";
/** A custom hook's natural home: a plain module, which `isComponentFile` does not claim. */
const HOOK_MODULE = "/repo/src/features/alpha/ui/use-annotation.ts";

describeRule("react/hook-count", hookCountRule, {
  obvious: [
    {
      name: "eight state, ref and effect hooks, one per line, none annotated",
      filename: UI,
      // Nothing about this is clever, which is the point: a miss here is a rule that stopped
      // running rather than one that met a spelling it could not read.
      code: `export function StackedHooks({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n: number) => n + 1, 0);
  const node = useRef(null);
  const timer = useRef(0);
  const [draft, setDraft] = useState("");
  useEffect(() => setName(id), [id]);
  useLayoutEffect(() => setDraft(name), [name]);
  return <div ref={node} data-count={count} data-timer={timer.current} onClick={() => setOpen(!open)}>{draft}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "a custom hook making twelve hook calls, in a plain .ts module",
      filename: HOOK_MODULE,
      // The hook half's own obvious case. The filename is the point as much as the count: a hook
      // lives in a `.ts`, which `isComponentFile` does not claim, so a rule that gated the whole
      // body on that predicate reports nothing here and reads as a clean file.
      code: `export function useAnnotationSurface(id: string) {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  useEffect(() => setC(0), []);
  return { label, other, box, onA, onB, onC, c };
}`,
      errors: [{ messageId: "tooManyHooksInHook" }],
    },
  ],

  adversarial: [
    {
      name: "two hooks share one line, and two more carry generic type arguments",
      filename: UI,
      // Seven, reached only if BOTH hooks on the shared line count and the type arguments on
      // `useState<string | null>` and `useRef<HTMLDivElement>` are tolerated. Either gap alone
      // scores six and the file goes silent — indistinguishable from a pass.
      code: `export function ManyHooks({ id }: { id: string }) {
  const [name, setName] = useState<string | null>(null);
  const node = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => setName(id), [id]);
  const first = useRef(0), second = useRef(1);
  useLayoutEffect(() => setOpen(true), []);
  return <div ref={node} data-a={first.current} data-b={second.current}>{open ? name : id}</div>;
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
  const [c, setC] = React.useState(id);
  const d = React.useRef(null);
  const e = React.useRef(null);
  React.useEffect(() => setA(id), [id]);
  React.useLayoutEffect(() => setB(id), [id]);
  return <div ref={d} data-e={String(e)} onClick={() => setC(id)}>{a + b + c}</div>;
});`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "seven hooks imported under names that are not hook-shaped",
      filename: UI,
      // The hook is whatever the MODULE exported, not what this file decided to call it. Read on
      // the local spelling alone, `pull` and `slot` are ordinary function calls and this
      // component makes no hook call.
      code: `import { useState as pull, useEffect as run, useRef as slot } from "react";

export function AliasedPanel({ id }: { id: string }) {
  const [name, setName] = pull(id);
  const [open, setOpen] = pull(false);
  const [draft, setDraft] = pull("");
  const node = slot(null);
  const timer = slot(0);
  run(() => setName(id), [id]);
  run(() => setDraft(name), [name]);
  return <div ref={node} data-timer={timer.current} onClick={() => setOpen(!open)}>{draft}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "TanStack Router's isomorphic layout effect is an effect, not wiring",
      filename: UI,
      // Imported from `@tanstack/*`, whose reads are wiring — but an effect is local logic
      // wherever it was imported from. Exempting by package alone scores this three.
      code: `import { useLayoutEffect as useServerSafeLayoutEffect } from "@tanstack/react-router";

export function MeasuredPanel({ id }: { id: string }) {
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const node = useRef<HTMLDivElement>(null);
  useServerSafeLayoutEffect(() => setHeight(1), [id]);
  useServerSafeLayoutEffect(() => setWidth(1), [id]);
  useServerSafeLayoutEffect(() => node.current?.focus(), [id]);
  useServerSafeLayoutEffect(() => setHeight(2), [width]);
  return <div ref={node}>{height}</div>;
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
  const [draft, setDraft] = useState("");
  const node = useRef(null);
  const timer = useRef(0);
  useEffect(() => setName(id), [id]);
  useEffect(() => setDraft(name), [name]);
  return <div ref={node} data-timer={timer.current} onClick={() => toggle(!open)}>{draft}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "seven hooks in a .jsx file",
      filename: UI_JSX,
      // The extension, not the syntax: a `.jsx` component is a component.
      code: `export function PlainPanel({ id }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n) => n + 1, 0);
  const node = useRef(null);
  const timer = useRef(0);
  useEffect(() => setName(id), [id]);
  useEffect(() => bump(), [open]);
  return <div ref={node} data-count={count} data-timer={timer.current} onClick={() => setOpen(true)}>{name}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "four hooks, against a threshold of 4 set in the project's config",
      filename: UI,
      options: [{ threshold: 4 }],
      // The option, proved in the direction that cannot pass by accident. Four hooks is silent at
      // the default of 7, so this fires only if the configured value reached the comparison.
      code: `export function ConfiguredPanel({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const node = useRef(null);
  useEffect(() => setName(id), [id]);
  return <div ref={node} data-open={open} onClick={() => setOpen(true)}>{name}</div>;
}`,
      errors: [{ messageId: "tooManyHooks" }],
    },
    {
      name: "a twelve-hook custom hook reached through an export list, and the message does not prescribe extraction",
      filename: HOOK_MODULE,
      // Two claims in one case. The declaration form is the one a hook-only reader would miss —
      // `export { useX }` sits below the declaration and resolves through scope analysis, which is
      // exactly the shared reading this rule now leans on.
      //
      // The message is asserted WHOLE because its wording carries what the messageId cannot. The
      // absent half is the load-bearing one: the component message's "Group the related ones into
      // a purpose-named custom hook" must NOT appear here. Prescribing that edit to something that
      // already is a custom hook is the loop the two thresholds exist to prevent, and at the
      // `messageId` level a rule that reported the component text would read identically.
      code: `const useAnnotationSurface = (id: string) => {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  useEffect(() => setC(0), []);
  return { label, other, box, onA, onB, onC, c };
};

export { useAnnotationSurface };`,
      errors: [
        {
          message:
            "useAnnotationSurface is a custom hook calling 12 state, ref, effect or custom hooks (threshold: 12). That threshold is higher than a component's on purpose, so this is not the extraction asking to be undone — it is a hook that became a module, and every consumer pays for all of it. Split it into several hooks named for what each one owns and let the caller compose them, or move the parts that do not need React state out into plain functions the hook calls. This warns rather than fails: a hook wrapping one genuinely large machine is a real shape.",
        },
      ],
    },
    {
      name: "four hooks in a custom hook, against a hookThreshold of 4 set in the project's config",
      filename: HOOK_MODULE,
      options: [{ hookThreshold: 4 }],
      // The hook knob, proved in the direction that cannot pass by accident. Four hook calls is
      // silent at the default of 12, so this fires only if the configured value reached the
      // comparison — a rule that declared `hookThreshold` in its schema and never read it reports
      // nothing here and looks exactly like one that works.
      code: `export function useConfiguredSurface(id: string) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const label = useRef(name);
  useEffect(() => setName(id), [id]);
  return { label, open, setOpen };
}`,
      errors: [{ messageId: "tooManyHooksInHook" }],
    },
    {
      name: "twelve hooks in a custom hook, against a hookThreshold the component threshold does not move",
      filename: HOOK_MODULE,
      options: [{ threshold: 20 }],
      // The two knobs are separate, proved in the direction that cannot pass by accident. A rule
      // reading one option for both subjects raises the hook limit to 20 here and goes silent.
      code: `export function useWideSurface(id: string) {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  useEffect(() => setC(0), []);
  return { label, other, box, onA, onB, onC, c };
}`,
      errors: [{ messageId: "tooManyHooksInHook" }],
    },
  ],

  legal: [
    {
      name: "six state and effect hooks is one under the threshold",
      filename: UI,
      // An over-count of exactly one is the likeliest arithmetic mistake, and no positive case
      // can see it.
      code: `export function SixHooksNeighbour({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const node = useRef(null);
  useEffect(() => setName(id), [id]);
  useEffect(() => setDraft(name), [name]);
  return <button type="button" ref={node} onClick={() => setOpen(!open)}>{draft}</button>;
}`,
    },
    {
      name: "a screen of data, form and router reads with two pieces of state",
      filename: UI,
      options: [{ wiringModules: ["@/shared/ui/form/form-hook"] }],
      // Thirteen hook calls, two of them local logic. Every other one subscribes to state a query
      // cache, the router or a form store owns, or derives without holding anything; counting
      // them makes this screen the finding, and the fix it asks for is a hook that forwards.
      code: `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { usePrimedSuspenseQuery } from "@/shared/primed-query";
import { useAppForm } from "@/shared/ui/form/form-hook";

export const Route = createFileRoute("/agents/$id")({ component: AgentScreen });

export function AgentScreen() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { data: agent } = usePrimedSuspenseQuery(agentQuery(id));
  const { data: connections } = useQuery(connectionsQuery());
  const client = useQueryClient();
  const save = useMutation({ mutationFn: saveAgent });
  const navigate = useNavigate();
  const form = useAppForm({ defaultValues: agent });
  const title = useMemo(() => agent.name, [agent]);
  const onDone = useCallback(() => navigate({ to: "/agents" }), [navigate]);
  const [preset, setPreset] = useState(search.preset);
  const [confirming, setConfirming] = useState(false);
  return <form data-c={connections?.length} data-q={String(client)} onSubmit={() => save.mutate(form.state.values, { onSuccess: onDone })}>{title}{preset}{String(confirming)}</form>;
}`,
    },
    {
      name: "eight local hooks in the file, seven of them consolidated into a custom hook",
      filename: UI,
      // The fix this rule asks for. Counting per FILE reports it, which is the over-match that
      // teaches people the warning is noise.
      code: `export function usePanelState(id: string) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n: number) => n + 1, 0);
  const node = useRef(null);
  const timer = useRef(0);
  useEffect(() => setName(id), [id]);
  useEffect(() => bump(), [open]);
  return { count, name, node, timer, setOpen, open };
}

export function ExtractedHookPanel({ id }: { id: string }) {
  const { count, name, node, setOpen, open } = usePanelState(id);
  return <div ref={node} data-count={count} onClick={() => setOpen(!open)}>{open ? name : id}</div>;
}`,
    },
    {
      name: "seven calls that are hook-shaped locally and are not hooks at the module that exports them",
      filename: UI,
      // A project that aliases a factory into hook clothing has not written seven hooks, and
      // reporting it would make the count something other than what the message says it is.
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
  const timer = useRef(0);
  useEffect(() => setName(id), [id]);
  useEffect(() => bump(), [open]);
  return <div ref={node} data-count={count} data-timer={timer.current} onClick={() => setOpen(true)}>{name}</div>;
}`,
    },
    {
      name: "eleven hooks in a custom hook is one under the hook threshold",
      filename: HOOK_MODULE,
      // The off-by-one, on the hook side. It also proves the hook limit is not the component's:
      // eleven is well over 7, so a rule sharing one number reports here.
      code: `export function useNearlyWide(id: string) {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  return { label, other, box, onA, onB, onC, c };
}`,
    },
    {
      name: "a hook-shaped name bound to a factory, with twelve hook calls in the file",
      filename: HOOK_MODULE,
      // The bound VALUE is tested, never the name alone — the same over-match guard the component
      // reading has, on the half that is new. `useAnnotationStore` is a store, and the twelve hook
      // calls beside it belong to a function this rule is right to leave alone: a name-only test
      // reports the store and attributes someone else's hooks to it.
      code: `export const useAnnotationStore = createStore({ open: false });

function surfaceInternals(id: string) {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  useEffect(() => setC(0), []);
  return { label, other, box, onA, onB, onC, c };
}`,
    },
    {
      name: "twelve hooks in a custom hook, against a hookThreshold of 13 set in the project's config",
      filename: HOOK_MODULE,
      options: [{ hookThreshold: 13 }],
      // The other direction. Twelve fires at the default, so a raised hook threshold that never
      // reached the comparison shows up as a failure here rather than as a knob nobody notices is
      // dead.
      code: `export function useRaisedSurface(id: string) {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  useEffect(() => setC(0), []);
  return { label, other, box, onA, onB, onC, c };
}`,
    },
    {
      name: "a hook-shaped name bound to memo, wrapping twelve hook calls",
      filename: HOOK_MODULE,
      // Wrappers are unwrapped for components and NOT for hooks, and this is the only case that
      // says so. `memo` takes a component and gives back a component; nothing wraps a hook that
      // way, so `useThing = memo(fn)` is a memoised component with a misleading name, not a hook.
      // A reader that unwrapped for both subjects reads the arrow as this hook's body and reports
      // twelve — and every positive case here passes either way.
      code: `export const useAnnotationSurface = memo((id: string) => {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  useEffect(() => setC(0), []);
  return { label, other, box, onA, onB, onC, c };
});`,
    },
    {
      name: "twelve hook calls under a name starting with use and no capital after it",
      filename: HOOK_MODULE,
      // The capital is the whole classifier, and only a legal neighbour can prove it is read.
      // `userAnnotations` is an ordinary function whose name happens to open with those three
      // letters; React does not treat it as a hook and neither does this rule. A classifier
      // loosened to `^use` reports here, and reports nothing different anywhere else in this file.
      code: `export function userAnnotations(id: string) {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  useEffect(() => setC(0), []);
  return { label, other, box, onA, onB, onC, c };
}`,
    },
    {
      name: "twelve hooks behind a PascalCase export in a plain .ts module",
      filename: HOOK_MODULE,
      // The negative space the header names, asserted rather than assumed. A component is counted
      // only where the project renders, so this file's PascalCase export is not a subject — and a
      // change that dropped the `isComponentFile` gate entirely turns every factory into a
      // component and shows up here rather than in a positive case.
      code: `export function AnnotationSurfaceFactory(id: string) {
  const [a, setA] = useState(id);
  const [b, setB] = useState(id);
  const [c, setC] = useState(0);
  const box = useRef(null);
  const label = useRef(a + b);
  const other = useRef(a.length);
  const onA = useRef(() => setA(id));
  const onB = useRef(() => setB(id));
  const onC = useRef(() => setC(1));
  useEffect(() => setA(id), [id]);
  useEffect(() => setB(id), [id]);
  useEffect(() => setC(0), []);
  return { label, other, box, onA, onB, onC, c };
}`,
    },
  ],
});
