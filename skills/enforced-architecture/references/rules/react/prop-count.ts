import type { StructuralCheck } from "../scripts/lib.ts";

export const propCountCheck: StructuralCheck = {
  id: "react/prop-count",
  run() {
    throw new Error("react/prop-count is registered but not implemented yet.");
  },
};
