// ADVERSARIAL, and it is the contract's NEVER clause: a boundary FABRICATED by a
// string. Nothing here imports the framework at all — a quoted import statement
// beside a local function aliased to the boundary's name was enough to stop the
// trace, which is a false negative and the one direction this check may not have.
export { settleFacade } from "./controllers/settle.ts";
