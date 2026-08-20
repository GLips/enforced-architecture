// SILENT in test-file-mirror: a cross-cutting suite, in the directory this
// catalog already recognises as holding one.
//
// No `checkout-flow` module sits beside it and none should — the suite exercises
// a path through several modules. Where such a suite may live was a configurable
// directory list, which is the orphan branch switched off one entry at a time;
// it is `__tests__` because that is what `__tests__` means everywhere else here.
export const checkoutFlowSteps = ["cart", "address", "payment"];
