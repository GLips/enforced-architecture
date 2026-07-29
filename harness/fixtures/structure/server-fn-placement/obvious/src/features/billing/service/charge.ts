import { createServerFn } from "@tanstack/react-start";

// EXPECT+1: a server function in service/ rather than controllers/
export const charge = createServerFn().handler(async () => null);
