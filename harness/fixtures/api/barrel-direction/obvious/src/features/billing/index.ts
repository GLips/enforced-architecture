// The shape the rule's header names: the client barrel re-exporting the
// server barrel, which pulls server-only code into every client bundle.

// EXPECT: a client barrel re-exporting its server barrel
export * from "./index.server";
