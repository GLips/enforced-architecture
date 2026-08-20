// The target of the ALIASED upward import. It sits in controllers rather than
// service so the aliased fixture climbs two rungs, not one — an implementation
// comparing adjacency instead of order lets a two-rung climb through.
export const handleRequest = () => "handled";
