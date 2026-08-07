// LEGAL: code samples inside template literals. Silent.
//
// Fires if extraction matches import statements as text. This check blocks, so
// documentation would fail the commit.
export const HOW_TO_LAZY_LOAD = `
  const { betaThing } = await import(
    "../../beta/service/beta-thing.ts"
  );
`;

// The single-line spelling too, which nothing else guards.
export const ONE_LINER = `import { betaThing } from "../../beta/service/beta-thing.ts";`;
