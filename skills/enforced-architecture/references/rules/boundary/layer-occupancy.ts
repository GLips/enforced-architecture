import type { StructuralCheck } from "../scripts/lib.ts";

export const layerOccupancyCheck: StructuralCheck = {
  id: "boundary/layer-occupancy",
  run() {
    throw new Error("boundary/layer-occupancy is registered but not implemented yet.");
  },
};
