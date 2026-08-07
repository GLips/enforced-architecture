# api/barrel-purity

| Field | Value |
|---|---|
| **Tag** | api |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Client-safe barrels (`index.ts`) that transitively import server-only packages through their re-exports. A barrel is the public API surface of a domain or a feature, so *any* module may import it — including route files and client components. If the barrel re-exports from a module that reaches `drizzle-orm`, `node:crypto`, or `stripe`, every client component importing the barrel breaks the bundle.

**No file in the chain looks wrong on its own.** The barrel re-exports a controller; the controller imports a service; the service imports `stripe`. Each file is ordinary and correct in isolation, and each was probably reviewed that way. Only a cross-file trace reveals the problem, which is the entire reason this is a script rather than a lint rule.

In SSR frameworks with server/client bundle splitting (TanStack Start, Next.js, SolidStart), server functions are a safe boundary: the framework compiler replaces the implementation with an RPC stub in the client bundle, so transitive server-only imports below one never reach the client. The trace has to account for that or it fires on the ordinary way a feature exposes a mutation.

## Where it applies

`domains/*/index.ts` and `features/*/index.ts` — the client-safe barrels. `index.server.ts` is server-only by construction and is not traced. Both sets come from `barrelDirs` / `barrelFilenames`.

**The domain-vs-feature distinction is the point of `serverFnBoundaryDirs`.** Feature barrels are traced *with* the server-function short-circuit, because features routinely re-export server-function references from `controllers/`. Domain barrels are traced *without* it: domains never define server functions, so a domain module that mentions the marker is always mentioning it, not defining one — and a check that short-circuits everywhere goes silent on domain barrels while staying green on every feature.

## Why not use the bundler

The bundler does the same analysis at build time, and it is not a substitute:

1. Its error is a long transitive import trace that says which *leaf* broke, not which barrel to fix. This check names the barrel, which is where the fix lands — move the export to `index.server.ts`, or put it behind a server function.
2. It only fires during `build`. This runs at pre-commit, so the chain never reaches a branch.

## The server-function short-circuit is an assumption, not a proof

When a module in the chain contains one of `serverFnMarkers`, the trace stops there.

**It is sound only when that module's exports are server functions plus types and nothing else.** The compiler strips the server function's `.handler()` body — not its siblings. An `export function helper()` in the same file ships to the client with its imports intact, so a server-only dependency reachable only through that plain export slips past this trace entirely.

Pair it with the per-file guard [`structure/no-plain-export-in-server-fn-module`](../structure/no-plain-export-in-server-fn-module.ts), which forbids most of that shape. **The pairing does not close the hole.** That rule documents its own negative space: a `function helper() {}` exported on a later line as `export { helper }` needs the declaration and the export list correlated by name, and a per-file pattern will not do it. So the short-circuit stays a documented assumption. If it matters more than the cost, delete it and trace through server-fn modules too — the cost is a longer trace, not a wrong answer.

Detection is a **string match** on the file's text, which makes the assumption weaker still: a comment, a string literal, or an unused import of the marker name stops the trace on a file defining no server function at all. It fails toward **under-reporting**, which is the direction to know about.

## Reuse the extraction, not the graph

This is the one check that does not consume the resolved import graph, and the reason is structural: graph resolution discards bare package specifiers as "not a boundary question", and **bare package names are precisely this rule's subject**. So it shares the extraction instead, importing `scanDeclaredImports` from the substrate — the union of `Bun.Transpiler.scanImports()` with `scan().imports`, minus Bun's injected JSX-runtime entries. See [graph/import-graph.md](../graph/import-graph.md) for why neither scan replaces the other, and why this is shared rather than copied.

The specifiers are unioned as a **set** rather than a multiset. This asks whether a package is reachable, never how many times, so the graph's occurrence-counting machinery buys nothing here.

## Type-only filtering, inverted

Both scans erase `import type`, and **that erasure is exactly the semantics wanted**: a type-only import emits no runtime code and cannot pull server-only code into a client bundle.

This is the inverse of the graph's problem. The graph has to work to *recover* the edges the reader erased, because a type crossing a boundary is still coupling. Here, take the erasure and do not reach for the reveal pass — doing so reports barrels for coupling that does not exist at runtime.

Mixed re-exports survive: `export { type Foo, bar } from "…"` keeps the chain alive because `bar` is a runtime dependency.

## Termination

`maxTraceDepth` bounds **cost only**. Cycle detection — a visited-file set per barrel — is what makes the recursion terminate; two modules re-exporting each other otherwise walk to the cap and report a truncated chain against a barrel that is clean.

**When the cap is hit, it is reported**, as an explicit "what lies below here is unknown". A silently truncated chain reads as a clean barrel, which is the failure mode this whole tier exists to make impossible.

Once a file is visited it is not re-traced, even when reached again by a different chain.

## Resolution gaps

Resolution tries the exact path, then `.ts`, `.tsx`, `/index.ts`, `/index.tsx`. It follows **both** relative and aliased (`@/…`) specifiers — an alias is the same edge spelled differently, and the aliased spelling is the one the boundary rules *require* of a crossing, so following only relative ones ends the trace at the first `@/shared/…` hop and reports clean.

Two gaps are real, and every message this check emits names them:

- no `.mts` / `.cts`
- no extension substitution — TypeScript resolves `./target.js` to `target.ts`; this does not

A hop spelled either way ends the trace without a word. Add the cases, or keep the limit stated where someone reading a finding will see it.

## Adapt

- **`serverOnlyPatterns`** — add every server-only package the project uses. Common additions: `ai` (Vercel AI SDK), `@sentry/*`, `posthog-node`, `@neondatabase/*`, database drivers, email SDKs. Regexes: `^name$` exact, `^name/` for subpaths, `^@scope/` for a whole scope.
- **`serverFnMarkers`** — `createServerFn` is TanStack Start. For Next.js the equivalent marker is the `"use server"` directive; for SolidStart, the server-function wrapper it ships. Frameworks with no such boundary get an empty list, and the trace runs all the way down.
- **`serverFnBoundaryDirs`** — the subdivided directories where that short-circuit applies. Only where server functions are actually defined.
- **`barrelDirs` / `barrelFilenames`** — the set of client-safe barrels. A project that names its subdivisions `modules/` says so here.
- **`maxTraceDepth`** — 6 covers barrel → controller → service → repo → infrastructure → dependency. Raise it if the cap starts reporting.

## Example output

```
FAIL [api/barrel-purity] src/features/checkout/index.ts:12
  Transitively pulls in the server-only package "stripe".
  Chain: src/features/checkout/index.ts → src/features/checkout/controllers/payments.ts → src/features/checkout/service/session.ts → stripe
  Every client component and route may import this barrel, so the whole chain
  lands in the client bundle and the build breaks. Move the server-only export
  to the sibling index.server.ts, or put it behind a server function.
  The package list is `serverOnlyPatterns` in the project's architecture config.
  Resolution here tries the exact path, then .ts, .tsx, /index.ts, /index.tsx. It
  does not handle .mts/.cts, and it does not substitute extensions the way
  TypeScript does (./target.js → target.ts), so a hop spelled either way ends the
  trace without a word.
```

## Implementation

[`api/barrel-purity.ts`](./barrel-purity.ts). Fixtures in [`expectations/api/barrel-purity.ts`](../../../../../harness/script-fixtures/expectations/api/barrel-purity.ts) cover the three-hop chain, the aliased middle hop, the domain barrel with a false marker, a legal chain below a real server-function boundary, a legal type-only reference, and a legal re-export cycle.
