// FIRES feature-deps (adversarial): one third of a THREE-feature ring.
//
// No two features here import each other, so a check that looks for reciprocal
// pairs — the shape everyone writes first, because it is the shape everyone
// pictures — reports this graph clean. Only a component algorithm sees it.
import { assignTicket } from "@/features/ring-two/index.ts";

export function openTicket(id: string): string {
  const assigned = assignTicket(id);
  return `open:${assigned}`;
}
