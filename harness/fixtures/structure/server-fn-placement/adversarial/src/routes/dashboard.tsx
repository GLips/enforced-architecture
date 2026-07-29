import { createServerFn } from "@tanstack/react-start";

// EXPECT+1: defined inline in a route, where nobody thinks to look for one
const load = createServerFn({ method: "GET" }).handler(async () => []);

// EXPECT+1: a SECOND definition in the same file, which needs per-match scoping
const save = createServerFn({ method: "POST" }).handler(async () => null);

export const Route = () => [load, save];
