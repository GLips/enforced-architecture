// ADVERSARIAL half one: a domain cycle whose other member is `.mts`-only.
//
// This check reads its nodes off the resolved graph, so a member whose only
// source file the graph's walk does not scan drops out of the component and the
// ring reports clean. `relaying` next door is that member.
import { relayedRate } from "@/domains/relaying";

export const mirroredRate = (): number => relayedRate() + 1;
