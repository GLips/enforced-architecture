import { createServerFn } from "@tanstack/react-start";
import { authed } from "./middleware.server";

// A server function importing its middleware from a sibling is the fix the
// rule asks for, and it must not itself be reported.
export const list = createServerFn().middleware([authed]).handler(async () => []);
