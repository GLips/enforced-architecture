import type { StructuralCheck } from "../scripts/lib.ts";

export const cssTokensCheck: StructuralCheck = {
  id: "style/css-tokens",
  run() {
    throw new Error("style/css-tokens is registered but not implemented yet.");
  },
};
