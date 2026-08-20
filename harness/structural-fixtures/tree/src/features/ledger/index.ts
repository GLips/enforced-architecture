// FIRES barrel-purity: the same violation with the hop resolved to an `.mts`
// file.
//
// The specifier is EXTENSIONLESS on purpose. Written as `./service/posting.mts`
// the exact-path try resolves it whatever the extension list says, and the
// fixture pins nothing. Written this way the trace only continues if the
// resolver tries `.mts` — which it did not, while this check spelled its own
// two-extension list against walkers that had eight. Its header named the hole
// and did not close it.
export { postEntry } from "./service/posting";
