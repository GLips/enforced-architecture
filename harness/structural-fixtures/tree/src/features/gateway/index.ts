// FIRES barrel-discoverability: the plain wildcard, alone in a barrel — the
// violation the rule's own doc opens with, written the way it is written there.
//
// It sits in its own feature rather than beside the adversarial shapes because
// the runner compares each KIND against the whole reported list. A path named in
// both `obvious` and `adversarial` therefore satisfies both from the same
// findings, and the count stops asserting anything: the four-shape barrel could
// lose a branch and still pass. One kind per path is what keeps the multiset
// load-bearing.
export * from "./service/gateway-routes.ts";
