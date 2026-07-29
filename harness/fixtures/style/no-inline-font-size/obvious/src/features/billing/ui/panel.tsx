export const styles = {
  // Biome reports a SOLE object member carrying a trailing comma twice — the
  // property node matches at two levels of the CST. It is a quirk of the
  // engine rather than of this rule, it hits every `$key: $value` rule in the
  // catalog, and it is asserted here so a Biome upgrade that changes it fails
  // loudly instead of quietly shifting every fixture's count.
  // EXPECT x2: a raw pixel size instead of a name from the scale
  fontSize: 13,
};
