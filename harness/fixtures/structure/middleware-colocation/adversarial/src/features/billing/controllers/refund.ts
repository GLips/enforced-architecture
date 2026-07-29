import { createMiddleware, createServerFn } from "@tanstack/react-start";

// EXPECT: declared BEFORE the server function, where a top-down reader stops
const logged = createMiddleware().server(({ next }) => next());

// EXPECT+1: a SECOND middleware in the same file, which needs per-match scoping
const audited = createMiddleware().server(({ next }) => next());

export const refund = createServerFn({ method: "POST" })
  .middleware([logged, audited])
  .handler(async () => null);
