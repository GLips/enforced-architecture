// Every line here is a runtime dependency spelled the way a naive
// `import { x } from "pkg"` pattern misses.

// EXPECT: a namespace re-export is not a JsImport node
export * from "expo-sqlite";

// EXPECT: a named re-export carries the same runtime dependency an import does
export { Stripe } from 'stripe';

// EXPECT: single quotes, where a regex anchored on \" alone would miss
import { useMemo } from 'react';

// EXPECT: a package subpath, where the pattern matched the bare package
import { deepThing } from "posthog-node/lib/deep";

// EXPECT+2: a dynamic import is a call expression, invisible to JsModuleSource
export const load = async () =>
  await import("@sentry/node");

// EXPECT: a mixed inline-type import still binds `readFile` at runtime
import { type Stats, readFile } from "node:fs";

export const used = [useMemo, deepThing, readFile];
export type ReExported = Stats;
