import { describeRule } from "../lib/rule-spec.ts";
import { noDirectFetchRule } from "./no-direct-fetch.ts";

const COMPONENT = "/repo/src/features/billing/ui/panel.tsx";

describeRule("react/no-direct-fetch", noDirectFetchRule, {
  obvious: [
    {
      name: "a bare fetch in a component file",
      filename: COMPONENT,
      code: `export const Panel = async () => {
  const res = await fetch("/api/invoices");
  return res.json();
};`,
      errors: [{ messageId: "directFetch" }],
    },
    {
      name: "a fetch inside an effect callback",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  useEffect(() => {
    void fetch(\`/api/invoices/\${id}\`, { method: "POST", body: "{}" });
  }, [id]);
  return null;
};`,
      errors: [{ messageId: "directFetch" }],
    },
  ],

  adversarial: [
    {
      name: "no arguments at all, where a pattern requiring one would miss",
      filename: COMPONENT,
      code: `export const Panel = () => {
  const ping = () => fetch();
  return ping;
};`,
      errors: [{ messageId: "directFetch" }],
    },
    {
      name: "two calls in the same file are two findings, not one per file",
      filename: COMPONENT,
      code: `export const Panel = () => {
  const refresh = () => fetch("/api/invoices");
  const purge = () => fetch("/api/invoices", { method: "DELETE" });
  return [refresh, purge];
};`,
      errors: [{ messageId: "directFetch" }, { messageId: "directFetch" }],
    },
    {
      name: "reaching the global through globalThis is the same request",
      filename: COMPONENT,
      code: `export const Panel = () => {
  const load = () => globalThis.fetch("/api/invoices");
  return load;
};`,
      errors: [{ messageId: "directFetch" }],
    },
    {
      name: "and through window, which is how a component usually spells it",
      filename: COMPONENT,
      code: `export const Panel = () => {
  const load = () => window.fetch("/api/invoices");
  return load;
};`,
      errors: [{ messageId: "directFetch" }],
    },
    {
      name: "a fetch buried in a JSX event handler rather than at the top level",
      filename: COMPONENT,
      code: `export const Panel = () => (
  <button onClick={() => void fetch("/api/invoices", { method: "POST" })}>Refresh</button>
);`,
      errors: [{ messageId: "directFetch" }],
    },
    {
      name: "a .tsx path under a directory that merely ends in 'scripts' is still component code",
      filename: "/repo/src/features/billing/ui/legacy-scripts-panel.tsx",
      code: `export const Panel = () => fetch("/api/invoices");`,
      errors: [{ messageId: "directFetch" }],
    },
  ],

  legal: [
    {
      name: "the query hook the rule points people to",
      filename: COMPONENT,
      code: `export const Panel = ({ id }) => {
  const { data } = useQuery({ queryKey: ["invoices", id], queryFn: () => listInvoices(id) });
  return data;
};`,
    },
    {
      name: "a method named fetch on some client object is somebody else's API",
      filename: COMPONENT,
      code: `export const Panel = ({ client, query }) => client.fetch(query);`,
    },
    {
      name: "the project's own wrapper, named so it reads as a call site and not the global",
      filename: COMPONENT,
      code: `import { apiFetch } from "@/shared/api";
export const Panel = () => apiFetch("/api/invoices");`,
    },
    {
      name: "identifiers that merely contain the name",
      filename: COMPONENT,
      code: `export const Panel = ({ refetch }) => {
  const meta = { fetchedAt: Date.now(), refetchInterval: 500 };
  return { refetch, meta };
};`,
    },
    {
      name: "a .ts infrastructure wrapper is exactly where the global belongs",
      filename: "/repo/src/infrastructure/http/client.ts",
      code: `export const apiFetch = (path: string) => fetch(path);`,
    },
    {
      name: "a server function module is not component code",
      filename: "/repo/src/features/billing/controllers/sync.ts",
      code: `export const syncInvoices = async () => (await fetch("https://api.stripe.com/v1")).json();`,
    },
    {
      name: "a component test may stub the network directly",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: `const seed = () => fetch("/api/invoices");`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/render-report.tsx",
      code: `const load = () => fetch("/api/invoices");`,
    },
  ],
});
