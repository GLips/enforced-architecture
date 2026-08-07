import type { StructuralCheck } from "../scripts/lib.ts";

export const testFileMirrorCheck: StructuralCheck = {
  id: "naming/test-file-mirror",
  run() {
    throw new Error("naming/test-file-mirror is registered but not implemented yet.");
  },
};
