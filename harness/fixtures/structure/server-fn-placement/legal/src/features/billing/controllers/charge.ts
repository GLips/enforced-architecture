import { createServerFn } from "@tanstack/react-start";

// controllers/ is the one place server functions belong.
export const charge = createServerFn({ method: "POST" }).handler(async () => null);
export const list = createServerFn().handler(async () => []);
