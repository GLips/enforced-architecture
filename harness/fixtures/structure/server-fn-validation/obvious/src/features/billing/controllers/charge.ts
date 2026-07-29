import { createServerFn } from "@tanstack/react-start";

// EXPECT+1: a handler that takes input, with no validator between the two calls
export const charge = createServerFn({ method: "POST" }).handler(async ({ data }) => data);
