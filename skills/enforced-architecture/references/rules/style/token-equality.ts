import type { StructuralCheck } from "../scripts/lib.ts";

export const tokenEqualityCheck: StructuralCheck = {
  id: "style/token-equality",
  run() {
    throw new Error("style/token-equality is registered but not implemented yet.");
  },
};
