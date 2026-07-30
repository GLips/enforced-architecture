# api/barrel-purity

| Field | Value |
|---|---|
| **Tag** | api |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Client-safe barrel files (`index.ts`) that transitively import server-only packages through their re-exports. Barrels are the public API surface for domains and features -- any module in the codebase can import them, including client-side UI components and route files. If a barrel re-exports from a module that imports `drizzle-orm`, `node:crypto`, `stripe`, or any other server-only package, every client component that imports the barrel will fail with a bundler error.

This violation is difficult to detect by reading a single file because the problem is transitive. The barrel re-exports from module A, which imports from module B, which imports from the server-only package. No single file in the chain looks wrong in isolation. Only a cross-file trace reveals the problem.

In SSR frameworks with server/client bundle splitting (TanStack Start, Next.js, SolidStart, etc.), server functions act as a safe boundary. The framework compiler replaces server function implementations with RPC stubs in client bundles, so transitive server-only imports below a server function boundary never reach the client. The trace must account for this -- when a file in the import chain defines a server function, that branch is safe and tracing stops.

## Where it applies

`src/domains/*/index.ts` and `src/features/*/index.ts` -- all client-safe barrel files.

Domain barrels are traced without the server function boundary exception (domains should never define server functions). Feature barrels are traced with it (features commonly re-export server function references from controllers).

## Algorithm

Recursive import tracing from each barrel file, with a depth limit to prevent infinite loops from circular re-exports.

1. **Find barrel files** -- Walk `src/domains/` and `src/features/` directories, collecting `index.ts` files.
2. **Extract imports** -- Union `Bun.Transpiler.scanImports()` with `Bun.Transpiler.scan().imports`, then filter Bun's injected JSX runtime entries as described in [graph/import-graph](../graph/import-graph.md#extraction). Type-only imports are erased by both scans.
3. **Check direct imports** -- For each runtime import, check the specifier against the server-only package blocklist. If it matches, record a violation with the full import chain.
4. **Follow internal imports** -- Resolve to a file path and recurse. Follow **both** relative specifiers and aliased ones (`@/…`) — an alias hop is the same edge written differently, and following only relative ones ends the trace at the first `@/shared/…` and reports clean. Resolve order: exact path, `.ts`, `.tsx`, `/index.ts`, `/index.tsx`.
5. **Server function boundary** -- Before recursing into a file, check if it defines a server function (`createServerFn` or equivalent). If so, stop tracing that branch -- the framework will strip everything below it from client bundles. **This short-circuit is only SOUND when the server-fn module's exports are server functions plus types and nothing else.** The compiler strips server-function `.handler()` bodies, not sibling plain exports — a `export function helper()` living in the same file ships to the client with its imports intact, so a server-only dependency reachable only through that plain export slips past this trace. Pair this script with the per-file guard `structure/no-plain-export-in-server-fn-module`, which forbids most of that shape. **It does not close the hole.** That rule documents its own negative space: a `function helper() {}` exported on a later line as `export { helper }` needs the declaration and the export list correlated by name, which a per-file pattern will not do. So the short-circuit stays a documented assumption, not a proof. If that matters, drop the short-circuit and trace through server-fn modules too — the cost is a longer trace, not a wrong answer.
6. **Depth limit** -- Stop tracing after 6 levels. Step 7 is what prevents infinite loops; this only bounds cost. 6 covers barrel -> controller -> service -> repo -> infrastructure -> dependency. **Report when the cap is hit** — a silently truncated chain reads as clean.
7. **Cycle detection** -- Track visited files to prevent infinite recursion from circular imports.

### Why not use the bundler

The bundler performs the same analysis at build time, but with two problems: (1) build errors from transitive server-only imports produce long, confusing import traces that don't tell the developer which barrel to fix, and (2) the build error only appears during `build`, not during development. This check runs at pre-commit, catches the problem early, and produces a clear error message pointing at the barrel and the offending chain.

## Configuration

```typescript
// Server-only package patterns. When a barrel transitively pulls in
// one of these via a runtime import, client bundles break.
const SERVER_ONLY_PATTERNS = [
  /^node:/,              // Node.js built-ins
  /^drizzle-orm/,        // Drizzle ORM (or your ORM)
  /^pg$/,                // PostgreSQL driver
  /^postgres$/,          // PostgreSQL driver
  /^better-auth/,        // BetterAuth
  /^stripe$/,            // Stripe
];

// Maximum depth for transitive import tracing
const MAX_TRACE_DEPTH = 6;
```

**Adjustments:**
- Add every server-only package your project uses to `SERVER_ONLY_PATTERNS`. Common additions: `ai` (Vercel AI SDK), `@sentry/*`, `posthog-node`, `@neondatabase/*`, database drivers, email SDKs.
- The patterns use regex. Use `^package-name$` for exact matches, `^package-name/` for scoped subpath imports, `^@scope/` for scoped packages.
- If your framework uses a different mechanism for server function boundaries, adjust the `hasServerFnBoundary()` check to detect it. For Next.js: look for `"use server"` directives. For SolidStart: look for server function wrappers.

## Implementation

Bun TypeScript script, delegated from the structural check orchestrator.

Key implementation details:
- **Import extraction** uses the union and JSX-runtime filter from [Extraction](../graph/import-graph.md#extraction). `scanImports()` supplies literal `require()` edges; `scan().imports` supplies `require.resolve()` edges. Neither can replace the other.

  It does **not** consume the resolved import graph, and that is the one place this rule differs from the graph's five consumers: graph resolution discards bare package specifiers as "not a boundary question", and bare package names are precisely this rule's subject. Reuse the extraction, not the graph.
- **Type-only filtering** is critical — a `type`-only import is erased at compile time and cannot pull in server-only code at runtime — and both scans omit it. Mixed re-exports (`export { type Foo, bar } from "..."`) remain because `bar` is a runtime dependency.

  This is the inverse of the graph's problem. The graph has to work to *recover* the type-only edges the reader erases, because a type-only import across a boundary is still coupling. Here the erasure is exactly the semantics wanted, so take it and do not reach for the reveal pass.
- **Resolution order** tries exact path first, then `.ts`, `.tsx`, `/index.ts`, `/index.tsx`. This approximates TypeScript's module resolution without the compiler API, and the gaps are real: no `.mts`/`.cts`, and no extension substitution (TypeScript resolves `./target.js` to `target.ts`; this does not). A specifier written either way ends the trace silently. Name that limit where the check reports, or add the cases.
- **Server function detection** scans file content for the framework's server function constructor (`createServerFn` for TanStack Start). A string match, so a comment, a string, or an unused import of that name stops the trace on a file that defines no server function at all. It fails toward under-reporting, which is the direction to know about given the short-circuit is already an assumption.
- **Cycle handling** uses a visited-file set per barrel check. Once a file is visited, it is not re-traced even if reached via a different import chain.

## Example output

```
FAIL [barrel-purity] src/features/billing/index.ts
  Transitively pulls in server-only package "stripe".
  Chain: src/features/billing/index.ts → src/features/billing/controllers/payments.ts → src/features/billing/service/checkout.ts → stripe
  Move the server-only export to src/features/billing/index.server.ts instead.
  Server-only package patterns are configured in the barrel-purity check script.

FAIL [barrel-purity] src/domains/pricing/index.ts
  Transitively pulls in server-only package "node:crypto".
  Chain: src/domains/pricing/index.ts → src/domains/pricing/encryption.ts → node:crypto
  Move the server-only export to src/domains/pricing/index.server.ts instead.
```
