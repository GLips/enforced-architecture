// The primitives layer is where the raw elements are allowed to live — it is
// what implements the primitives everyone else composes.
export const Box = (p: { children?: unknown }) => <div>{p.children}</div>;
