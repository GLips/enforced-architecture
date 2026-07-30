import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// EXPECT: intermediate middleware must not hide the deprecated method
export const refund = createServerFn()
  .middleware([])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => data);

// EXPECT: middleware uses the same deprecated method
export const validated = createMiddleware({ type: "function" })
  .inputValidator(z.object({ id: z.string() }))
  .server(({ next }) => next());
