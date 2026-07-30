import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// EXPECT: deprecated server-function validator method
export const charge = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => data);
