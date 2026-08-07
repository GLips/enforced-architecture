import type { StructuralCheck } from "../scripts/lib.ts";

export const featureDepsCheck: StructuralCheck = {
  id: "graph/feature-deps",
  run() {
    throw new Error("graph/feature-deps is registered but not implemented yet.");
  },
};
