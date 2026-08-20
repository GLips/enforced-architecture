import { closeTicket } from "@/features/ring-three/index.ts";

export function assignTicket(id: string): string {
  const closed = closeTicket(id);
  return `assign:${closed}`;
}
