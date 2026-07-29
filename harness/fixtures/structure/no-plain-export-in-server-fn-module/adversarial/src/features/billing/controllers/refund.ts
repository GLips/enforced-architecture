import { createServerFn } from "@tanstack/react-start";
import { db } from "@/infrastructure/db";

export const refund = createServerFn().handler(async () => db);

// EXPECT+1: an explicit return type, which the untyped arm alone would miss
export function label(n: number): string {
  return String(n);
}

// EXPECT+1: async, the second half of the same axis
export async function reload(): Promise<void> {}

// EXPECT+1: a SECOND plain export, which needs per-match scoping
export function other(n: number) {
  return n;
}

// EXPECT+1: a default export, which carries the module's imports just the same
export default function fallback(n: number) {
  return n;
}

// EXPECT+1: an arrow assigned to a const, the form the checklist names
export const arrowHelper = (n: number) => n * 2;

// EXPECT+1: the async arrow, covered by the same arm
export const asyncHelper = async (n: number) => n * 2;
