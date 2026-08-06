// LEGAL: the same wrapped forms, landing inside features/alpha. Silent.
//
// Says the wrapped edges next door were found without inventing crossings among
// the legal ones.
export async function loadAlphaThing() {
  const { alphaThing } = await import(
    "../service/alpha-thing.ts"
  );
  return alphaThing;
}
