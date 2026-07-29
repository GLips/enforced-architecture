// The primitives layer is what builds ON the raw surface, so it is exempt —
// without this exemption the rule fires on its own implementation.
export const Box = (p: { padding: number }) => <div style={{ padding: p.padding }} />;
