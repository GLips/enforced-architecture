import type { StructuralCheck } from "../scripts/lib.ts";

export const barrelPurityCheck: StructuralCheck = {
  id: "api/barrel-purity",
  run() {
    throw new Error("api/barrel-purity is registered but not implemented yet.");
  },
};
