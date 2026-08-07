import type { StructuralCheck } from "../scripts/lib.ts";

export const crossBoundaryAliasCheck: StructuralCheck = {
  id: "boundary/cross-boundary-alias",
  run() {
    throw new Error("boundary/cross-boundary-alias is registered but not implemented yet.");
  },
};
