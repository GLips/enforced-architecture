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
2. **Extract imports** -- Parse `import ... from "..."` and `export ... from "..."` statements. Distinguish type-only imports (`import type`, `export type`) from runtime imports. Type-only imports are safe (erased at compile time) and are skipped.
3. **Check direct imports** -- For each runtime import, check the specifier against the server-only package blocklist. If it matches, record a violation with the full import chain.
4. **Follow relative imports** -- For relative specifiers (starting with `./` or `../`), resolve to a file path and recurse. Resolve order: exact path, `.ts`, `.tsx`, `/index.ts`, `/index.tsx`.
5. **Server function boundary** -- Before recursing into a file, check if it defines a server function (`createServerFn` or equivalent). If so, stop tracing that branch -- the framework will strip everything below it from client bundles.
6. **Depth limit** -- Stop tracing after 6 levels deep. This prevents infinite loops and keeps the check fast. 6 levels covers barrel -> controller -> service -> repo -> infrastructure -> dependency, which is deeper than any valid chain.
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
- **Import extraction** uses regex, not a full parser. Matches `import/export ... from "..."` patterns including multi-line statements. Detects `type` keyword for type-only filtering.
- **Type-only filtering** is critical. A `type`-only import is erased at compile time and cannot pull in server-only code at runtime. Mixed re-exports (`export { type Foo, bar } from "..."`) are treated conservatively as runtime (the non-type export `bar` is a runtime dependency).
- **Resolution order** tries exact path first, then `.ts`, `.tsx`, `/index.ts`, `/index.tsx`. This matches TypeScript's module resolution without needing the compiler API.
- **Server function detection** scans file content for the framework's server function constructor (`createServerFn` for TanStack Start). This is a string match, not AST analysis -- fast and sufficient for the purpose.
- **Cycle handling** uses a visited-file set per barrel check. Once a file is visited, it is not re-traced even if reached via a different import chain.

## Example output

```
FAIL [barrel-purity] src/features/billing/index.ts
  Transitively pulls in server-only package "stripe".
  Chain: src/features/billing/index.ts → src/features/billing/controllers/payments.ts → src/features/billing/service/checkout.ts → stripe
  Move the server-only export to src/features/billing/server.ts instead.
  Server-only package patterns are configured in the barrel-purity check script.

FAIL [barrel-purity] src/domains/pricing/index.ts
  Transitively pulls in server-only package "node:crypto".
  Chain: src/domains/pricing/index.ts → src/domains/pricing/encryption.ts → node:crypto
  Move the server-only export to src/domains/pricing/server.ts instead.
```
