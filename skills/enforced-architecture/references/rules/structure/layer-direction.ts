import type { StructuralCheck } from "../scripts/lib.ts";

export const layerDirectionCheck: StructuralCheck = {
  id: "structure/layer-direction",
  run() {
    throw new Error("structure/layer-direction is registered but not implemented yet.");
  },
};
