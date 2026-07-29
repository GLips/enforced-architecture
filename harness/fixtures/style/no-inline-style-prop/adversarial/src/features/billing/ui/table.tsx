export const Row = () => (
  <span
    // EXPECT+1: spread across lines, where a single-line pattern loses it
    style={{
      padding: 12,
      margin: 4,
    }}
  />
);

// EXPECT+2: a SECOND occurrence in the same file, which needs per-match scoping
export const Cell = () => (
  <span style={{ gap: 8 }} />
);
