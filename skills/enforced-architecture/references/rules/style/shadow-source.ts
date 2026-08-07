import type { StructuralCheck } from "../scripts/lib.ts";

export const shadowSourceCheck: StructuralCheck = {
  id: "style/shadow-source",
  run() {
    throw new Error("style/shadow-source is registered but not implemented yet.");
  },
};
