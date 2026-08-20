// ADVERSARIAL half two: the `.mts`-only member of the mirrored/relaying cycle.
//
// Nothing about the extension is incidental. This file is the only source in
// the directory, so a graph walk spelling `**/*.{ts,tsx}` never scans the edge
// back to `mirrored`, the component collapses to one member, and a two-domain
// cycle disappears with no diagnostic anywhere.
import { mirroredRate } from "@/domains/mirrored";

export const relayedRate = (): number => (mirroredRate() > 0 ? 1 : 0);
