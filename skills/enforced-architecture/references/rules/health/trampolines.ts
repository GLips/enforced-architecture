import type { StructuralCheck } from "../scripts/lib.ts";

export const trampolinesCheck: StructuralCheck = {
  id: "health/trampolines",
  run() {
    throw new Error("health/trampolines is registered but not implemented yet.");
  },
};
