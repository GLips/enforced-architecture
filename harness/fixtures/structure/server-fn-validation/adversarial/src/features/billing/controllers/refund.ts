import { createServerFn } from "@tanstack/react-start";

// EXPECT+1: no config argument at all, where a pattern requiring one would miss
export const refund = createServerFn().handler(async ({ data }) => data);

// EXPECT: spread across lines, destructuring more than one key
export const partial = createServerFn({ method: "POST" })
  .handler(async ({ data, context }) => [data, context]);

// EXPECT+1: a single unnamed parameter rather than a destructured object
export const raw = createServerFn({ method: "POST" }).handler(async (input) => input);

// EXPECT+1: middleware is not validation and must not hide the missing validator
export const guarded = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ data }) => data);

// EXPECT+1: validation is required for a synchronous handler too
export const synchronous = createServerFn({ method: "POST" }).handler(({ data }) => data);

declare const authMiddleware: unknown;
