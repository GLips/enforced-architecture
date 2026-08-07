import type { StructuralCheck } from "../scripts/lib.ts";

export const barrelDiscoverabilityCheck: StructuralCheck = {
  id: "naming/barrel-discoverability",
  run() {
    throw new Error("naming/barrel-discoverability is registered but not implemented yet.");
  },
};
