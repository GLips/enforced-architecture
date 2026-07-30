import { createMiddleware } from "@tanstack/react-start";

// EXPECT: compiler bridges must use named exports
export default createMiddleware().server(({ next }) => next());
