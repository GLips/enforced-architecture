// The hop that closes the ring. Read in isolation it is a leaf importing a
// neighbour; the cycle exists only in the component.
import { openTicket } from "@/features/ring-one/index.ts";

export function closeTicket(id: string): string {
  const opened = openTicket.name;
  return `close:${opened}:${id}`;
}
