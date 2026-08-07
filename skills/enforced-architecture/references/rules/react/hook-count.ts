import type { StructuralCheck } from "../scripts/lib.ts";

export const hookCountCheck: StructuralCheck = {
  id: "react/hook-count",
  run() {
    throw new Error("react/hook-count is registered but not implemented yet.");
  },
};
