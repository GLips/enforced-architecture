import { describeRule } from "../lib/rule-spec.ts";
import { derivedStateRule } from "./derived-state.ts";

const COMPONENT = "/repo/src/features/billing/ui/summary.tsx";
const HOOK = "/repo/src/features/billing/ui/use-invoice-total.ts";

describeRule("react/derived-state", derivedStateRule, {
  obvious: [
    {
      name: "state synced from props through an effect",
      filename: COMPONENT,
      code: `export const Total = ({ items }) => {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.reduce((a, b) => a + b, 0));
  }, [items]);
  return total;
};`,
      errors: [{ messageId: "derivedState" }],
    },
    {
      name: "the same anti-pattern in a plain .ts hook module",
      filename: HOOK,
      code: `export const useInvoiceTotal = (rate: number) => {
  const [tax, setTax] = useState(0);
  useEffect(() => {
    setTax(rate * 0.2);
  }, [rate]);
  return tax;
};`,
      errors: [{ messageId: "derivedState" }],
    },
  ],

  adversarial: [
    {
      name: "the setter sits inside a nested helper, not at the effect callback's top level",
      filename: COMPONENT,
      code: `export const Summary = ({ items }) => {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const recompute = () => setTotal(items.reduce((a, b) => a + b, 0));
    recompute();
  }, [items]);
  return total;
};`,
      errors: [{ messageId: "derivedState" }],
    },
    {
      name: "two effects in the same component are two findings, not one per file",
      filename: COMPONENT,
      code: `export const Summary = ({ items, rate }) => {
  const [total, setTotal] = useState(0);
  const [tax, setTax] = useState(0);
  useEffect(() => { setTotal(items.length); }, [items]);
  useEffect(() => { setTax(items.length * rate); }, [items, rate]);
  return total + tax;
};`,
      errors: [{ messageId: "derivedState" }, { messageId: "derivedState" }],
    },
    {
      name: "the updater-function form, where the setter's argument is itself a callback",
      filename: COMPONENT,
      code: `export const Summary = ({ rate }) => {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal((prev) => prev + rate);
  }, [rate]);
  return total;
};`,
      errors: [{ messageId: "derivedState" }],
    },
    {
      name: "a hole in the destructure still binds a setter",
      filename: COMPONENT,
      code: `export const Summary = ({ items }) => {
  const [, setTotal] = useState(0);
  useEffect(() => { setTotal(items.length); }, [items]);
  return null;
};`,
      errors: [{ messageId: "derivedState" }],
    },
    {
      name: "an awaiting effect elsewhere in the file must not excuse a synchronous one",
      filename: COMPONENT,
      code: `export const Summary = ({ id, items }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    void (async () => { setRows(await loadRows(id)); })();
  }, [id]);
  useEffect(() => { setTotal(items.length); }, [items]);
  return total + rows.length;
};`,
      errors: [{ messageId: "derivedState" }],
    },
    {
      name: "both hooks written as members of the React namespace",
      filename: COMPONENT,
      // The spelling that split this rule from react/hook-count. `React.useState` binds the same
      // setter and `React.useEffect` runs the same effect; reading `Identifier` only makes a file
      // that writes `React.` on every hook invisible to both halves of this rule at once.
      code: `export const Summary = ({ items }) => {
  const [total, setTotal] = React.useState(0);
  React.useEffect(() => { setTotal(items.length); }, [items]);
  return total;
};`,
      errors: [{ messageId: "derivedState" }],
    },
    {
      name: "a setter the destructure did not name set-anything",
      filename: COMPONENT,
      // The destructure is the whole test. `updateTotal` is a useState setter by where it came
      // from, and a rule that also required `set[A-Z]` reported nothing here while its header said
      // the name was not the question.
      code: `export const Summary = ({ items }) => {
  const [total, updateTotal] = useState(0);
  useEffect(() => { updateTotal(items.length); }, [items]);
  return total;
};`,
      errors: [{ messageId: "derivedState" }],
    },
    {
      name: "a setter buried in a branch inside a loop inside the callback",
      filename: COMPONENT,
      code: `export const Summary = ({ items }) => {
  const [max, setMax] = useState(0);
  useEffect(() => {
    for (const item of items) {
      if (item > max) { setMax(item); }
    }
  }, [items, max]);
  return max;
};`,
      errors: [{ messageId: "derivedState" }],
    },
  ],

  legal: [
    {
      name: "useMemo is the refactor the rule asks for",
      filename: COMPONENT,
      code: `export const Summary = ({ items }) => {
  const total = useMemo(() => items.reduce((a, b) => a + b, 0), [items]);
  return total;
};`,
    },
    {
      name: "an effect that awaits is fetching data, not deriving it",
      filename: COMPONENT,
      code: `export const Summary = ({ id }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const load = async () => { setRows(await loadRows(id)); };
    void load();
  }, [id]);
  return rows;
};`,
    },
    {
      name: "a promise chain is the same external system spelled without await",
      filename: COMPONENT,
      code: `export const Summary = ({ id }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => { loadRows(id).then((r) => setRows(r)); }, [id]);
  return rows;
};`,
    },
    {
      name: "a timer sets state on a schedule, which no computation can replace",
      filename: COMPONENT,
      code: `export const Clock = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};`,
    },
    {
      name: "a subscription is an external event source, not derivation",
      filename: COMPONENT,
      code: `export const Width = () => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    window.addEventListener("resize", () => setWidth(window.innerWidth));
  }, []);
  return width;
};`,
    },
    {
      name: "a helper that merely starts with 'set' is not a useState setter",
      filename: COMPONENT,
      code: `import { setTitle } from "@/shared/document";
export const Summary = ({ id }) => {
  useEffect(() => { setTitle(id); settle(id); }, [id]);
  return null;
};`,
    },
    {
      name: "a setter in an event handler is the ordinary way to use useState",
      filename: COMPONENT,
      code: `export const Summary = () => {
  const [rows, setRows] = useState([]);
  const onClick = useCallback(() => setRows([]), []);
  return onClick;
};`,
    },
    {
      name: "a test file may drive state however it needs to",
      filename: "/repo/src/features/billing/ui/summary.test.tsx",
      code: `const Probe = ({ items }) => {
  const [total, setTotal] = useState(0);
  useEffect(() => { setTotal(items.length); }, [items]);
  return total;
};`,
    },
  ],
});
