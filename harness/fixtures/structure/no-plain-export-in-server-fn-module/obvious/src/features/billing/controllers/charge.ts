import { createServerFn } from "@tanstack/react-start";
import { db } from "@/infrastructure/db";

export const charge = createServerFn().handler(async () => db);

// EXPECT+1: plain runtime export beside a server function
export function formatCents(n: number) {
  return `${n / 100}`;
}
