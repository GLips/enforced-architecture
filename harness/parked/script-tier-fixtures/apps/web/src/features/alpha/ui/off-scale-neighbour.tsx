// LEGAL: values that look exactly like the violation but are not on the scale.
// Silent.
//
// This is the neighbour that matters most for token-equality, because the check
// is only defensible if it stays quiet on off-scale numbers. Spacing runs
// 10/12/16/20/32 and radius 2/4/6/8/12; every number here misses deliberately,
// and `gap="md"` is the fixed form the check tells people to write.
//
// The zero is not filler either: `radius="none"` is 0px, and 0 is dropped from
// the scale on purpose — a rule that rewrote `gap={0}` to a token would be
// wrong, since 0 is a no-op rather than a spacing decision.
export function OffScaleNeighbour() {
  return (
    <div style={{ padding: 7, borderRadius: 5 }}>
      <section gap="md" radius={0} />
      <section gap={7} radius={5} />
    </div>
  );
}
