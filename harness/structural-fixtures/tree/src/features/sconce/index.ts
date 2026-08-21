// ADVERSARIAL: the boundary's NAME imported, from the boundary's module, bound
// to something else entirely — `import { unrelatedExport as createServerFn }`.
// A clause reader that searches for the call's name finds it on the LOCAL side
// of the `as` and reads the file as importing the boundary.
export { settleSconce } from "./controllers/settle.ts";
