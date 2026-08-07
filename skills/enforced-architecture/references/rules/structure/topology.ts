import type { StructuralCheck } from "../scripts/lib.ts";

export const topologyCheck: StructuralCheck = {
  id: "structure/topology",
  run() {
    throw new Error("structure/topology is registered but not implemented yet.");
  },
};
