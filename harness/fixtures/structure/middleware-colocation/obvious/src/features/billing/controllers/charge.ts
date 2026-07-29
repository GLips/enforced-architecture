import { createServerFn, createMiddleware } from "@tanstack/react-start";

// EXPECT+1: middleware sharing a file with a server function
const authed = createMiddleware().server(({ next }) => next());

export const charge = createServerFn().handler(async () => authed);
