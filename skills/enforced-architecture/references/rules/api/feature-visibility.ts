import type { StructuralCheck } from "../scripts/lib.ts";

export const featureVisibilityCheck: StructuralCheck = {
  id: "api/feature-visibility",
  run() {
    throw new Error("api/feature-visibility is registered but not implemented yet.");
  },
};
