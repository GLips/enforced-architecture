import { createMiddleware } from "@tanstack/react-start";

// Middleware alone in a file is the whole point — no createServerFn here, so
// nothing to co-locate with.
export const authed = createMiddleware().server(({ next }) => next());
export const logged = createMiddleware().server(({ next }) => next());
