import type { StructuralCheck } from "../scripts/lib.ts";

export const singleComponentExportCheck: StructuralCheck = {
  id: "react/single-component-export",
  run() {
    throw new Error("react/single-component-export is registered but not implemented yet.");
  },
};
