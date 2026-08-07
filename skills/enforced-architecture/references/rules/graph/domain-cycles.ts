import type { StructuralCheck } from "../scripts/lib.ts";

export const domainCyclesCheck: StructuralCheck = {
  id: "graph/domain-cycles",
  run() {
    throw new Error("graph/domain-cycles is registered but not implemented yet.");
  },
};
