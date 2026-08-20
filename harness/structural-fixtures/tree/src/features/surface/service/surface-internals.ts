// LEGAL: a wildcard re-export in a file that is not a barrel. Silent.
//
// The statement here is character-for-character the violation, and it is allowed
// because of WHERE it sits: only the public surface has to stay greppable, and
// how a module forwards names among its own files is the module's business. A
// check that walks the tree instead of the configured barrel globs reports this,
// and the first thing that teaches is that the rule fires on ordinary code.
export * from "./surface-labels.ts";
