import { createServerFn } from "@tanstack/react-start";

// EXPECT+1: no config argument at all, where a pattern requiring one would miss
export const refund = createServerFn().handler(async ({ data }) => data);

// EXPECT: spread across lines, destructuring more than one key
export const partial = createServerFn({ method: "POST" })
  .handler(async ({ data, context }) => [data, context]);

// EXPECT+1: a single unnamed parameter rather than a destructured object
export const raw = createServerFn({ method: "POST" }).handler(async (input) => input);
