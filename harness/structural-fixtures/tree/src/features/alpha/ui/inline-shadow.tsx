// FIRES shadow-source: the JS spelling of the same rule.
//
// `box-shadow` and `boxShadow` are separate branches selected by file
// extension, so the CSS fixture next door does not cover this one. An inline
// style and a Mantine `styles` object are the two places it actually shows up.
export function InlineShadow() {
  return <div style={{ boxShadow: "0 2px 4px var(--tk-accent)" }} />;
}
