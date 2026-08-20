// FIRES layer-direction: the same upward import, one directory deeper.
//
// A pattern over the specifier expects one `../` before the layer name. From
// `repo/nested/` the identical edge is spelled `../../service/…`, and the
// branch never fires. Nothing in this string says which layer it leaves —
// that is a function of where THIS file sits, so it has to be resolved.
export { listRows } from "../../service/queries.ts";
