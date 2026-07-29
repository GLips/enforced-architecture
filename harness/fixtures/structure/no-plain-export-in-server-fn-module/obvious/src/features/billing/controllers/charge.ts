import { createServerFn } from "@tanstack/react-start";
import { db } from "@/infrastructure/db";

export const charge = createServerFn().handler(async () => db);

// EXPECT+1: a plain export beside a server fn, carrying its imports to the client
export function formatCents(n: number) {
  return `${n / 100}`;
}
