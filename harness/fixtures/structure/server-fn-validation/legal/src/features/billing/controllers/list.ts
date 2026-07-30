import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// A validator between the two calls is exactly what the rule asks for.
export const list = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => data);

// A handler that takes no input has nothing to validate.
export const all = createServerFn({ method: "GET" }).handler(async () => []);
export const ping = createServerFn().handler(async () => "ok");

// Context is framework-provided, not client input.
export const currentUser = createServerFn().handler(async ({ context }) => context.user);
