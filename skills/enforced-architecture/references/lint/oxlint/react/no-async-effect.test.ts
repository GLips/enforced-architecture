import { describeRule } from "../lib/rule-spec.ts";
import { noAsyncEffectRule } from "./no-async-effect.ts";

const COMPONENT = "/repo/src/features/billing/ui/panel.tsx";
const COMPONENT_JSX = "/repo/src/features/billing/ui/panel.jsx";

describeRule("react/no-async-effect", noAsyncEffectRule, {
  obvious: [
    {
      name: "an awaited load inside an effect with no cleanup return",
      filename: COMPONENT,
      code: `export const Loader = ({ id }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    void (async () => { setRows(await fetchRows(id)); })();
  }, [id]);
  return rows;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
    {
      name: "an async function declaration inside the effect",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  useEffect(() => {
    async function run() { record(await fetchRows(id)); }
    void run();
  }, [id]);
  return null;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
    {
      name: "an async useCallback, the indirect spelling of the same leak",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  const reload = useCallback(async () => { await fetchRows(id); }, [id]);
  return reload;
};`,
      errors: [{ messageId: "asyncCallback" }],
    },
  ],

  adversarial: [
    {
      name: "a return-type annotation on the async arrow, which a source snippet with no slot for it never matched",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  useEffect(() => {
    const run = async (): Promise<void> => { record(id); };
    void run();
  }, [id]);
  return null;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
    {
      name: "the same annotation on an async function declaration",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  useEffect(() => {
    async function run(): Promise<void> { record(id); }
    void run();
  }, [id]);
  return null;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
    {
      name: "an annotated async useCallback, and the function-expression spelling of one",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  const reload = useCallback(async (): Promise<void> => { record(id); }, [id]);
  const refresh = useCallback(async function () { record(id); }, [id]);
  return [reload, refresh];
};`,
      errors: [{ messageId: "asyncCallback" }, { messageId: "asyncCallback" }],
    },
    {
      name: "a bare promise chain is async work without the async keyword",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => { fetchRows(id).then(setRows); }, [id]);
  return rows;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
    {
      name: "an effect and an async callback in one file are both reported in one pass",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  const reload = useCallback(async () => { await fetchRows(id); }, [id]);
  useEffect(() => { void (async () => { await ping(); })(); }, [id]);
  return reload;
};`,
      errors: [{ messageId: "asyncCallback" }, { messageId: "asyncEffect" }],
    },
    {
      name: "both hooks written as members of the React namespace",
      filename: COMPONENT,
      // The spelling that made this rule and react/hook-count disagree about the same file:
      // `React.useEffect` was a hook to one of them and a call expression to the other, so a
      // component with `React.` on every line drew a warning about hook volume and nothing about
      // the leak inside it. A clean half certifies the missing half.
      code: `export const Panel = ({ id }: { id: string }) => {
  const reload = React.useCallback(async () => { await fetchRows(id); }, [id]);
  React.useEffect(() => { void (async () => { await ping(); })(); }, [id]);
  return reload;
};`,
      errors: [{ messageId: "asyncCallback" }, { messageId: "asyncEffect" }],
    },
    {
      name: "the effect hook under a local alias whose name also declares a type",
      filename: COMPONENT,
      // `run` is what this file calls it; `useEffect` is what react exported. The second is the
      // hook's identity, and reading the first leaves the whole file unread.
      //
      // The type alias above it compiles — an import binding and a type of one name merge rather
      // than collide — and oxlint files both under ONE binding with the type declaration first. A
      // resolver that read the first definition and stopped finds a `TSTypeAliasDeclaration`, no
      // import, and no hook.
      code: `type run = never;
import { useEffect as run } from "react";
export const Panel = ({ id }: { id: string }) => {
  run(() => { void (async () => { await fetchRows(id); })(); }, [id]);
  return null;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
    {
      name: "a leaking effect in a .jsx file",
      filename: COMPONENT_JSX,
      // The extension, not the syntax. A `.jsx` component leaks exactly as a `.tsx` one does.
      code: `export const PlainLoader = ({ id }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => { fetchRows(id).then(setRows); }, [id]);
  return rows;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
    {
      name: "an effect callback that is itself an async arrow",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  useEffect(async () => { await fetchRows(id); }, [id]);
  return null;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
    {
      name: "a cleaned-up effect earlier in the file must not excuse a leaking one after it",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  useEffect(() => {
    let cancelled = false;
    void (async () => { if (!cancelled) record(await fetchRows(id)); })();
    return () => { cancelled = true; };
  }, [id]);
  useEffect(() => { void (async () => { await ping(); })(); }, [id]);
  return null;
};`,
      errors: [{ messageId: "asyncEffect" }],
    },
  ],

  legal: [
    {
      name: "a plainly synchronous effect",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  useEffect(() => { document.title = id; }, [id]);
  return null;
};`,
    },
    {
      name: "async work that declares how it unwinds",
      filename: COMPONENT,
      code: `export const Live = ({ id }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next = await fetchRows(id);
      if (!cancelled) setRows(next);
    };
    void run();
    return () => { cancelled = true; };
  }, [id]);
  return rows;
};`,
    },
    {
      name: "a synchronous useCallback is the ordinary use of the hook",
      filename: COMPONENT,
      code: `export const Panel = () => {
  const clear = useCallback(() => setRows([]), []);
  return clear;
};`,
    },
    {
      name: "async work outside any effect is not the effect's problem",
      filename: COMPONENT,
      code: `async function loadRows(id) { return fetchRows(id); }
export const Panel = ({ id }) => {
  useEffect(() => { track(id); }, [id]);
  return null;
};`,
    },
    {
      name: "an async event handler on an element runs on user intent, not on render",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => (
  <button onClick={async () => { await save(id); }}>Save</button>
);`,
    },
    {
      name: "a .ts module is not a component file",
      filename: "/repo/src/features/billing/service/load.ts",
      code: `export const load = (id: string) => {
  useEffect(() => { fetchRows(id).then(setRows); }, [id]);
};`,
    },
    {
      name: "a component test may drive an effect however it needs to",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: `const Probe = ({ id }) => {
  useEffect(() => { void (async () => { await fetchRows(id); })(); }, [id]);
  return null;
};`,
    },
    {
      name: "a directory that merely ends in 'scripts' is not the scripts root",
      filename: "/repo/src/features/billing/ui/legacy-scripts-panel.tsx",
      code: `export const Panel = ({ id }) => {
  useEffect(() => { track(id); }, [id]);
  return null;
};`,
    },
  ],
});
