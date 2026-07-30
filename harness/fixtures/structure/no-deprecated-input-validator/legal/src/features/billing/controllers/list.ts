import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const list = createServerFn()
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => data);

export const validated = createMiddleware({ type: "function" })
  .validator(z.object({ id: z.string() }))
  .server(({ next }) => next());
