// FIRES token-equality four times: a raw px that is EXACTLY a named token, in
// each of the four forms the check knows.
//
// The point of the rule is that these are not off-scale values someone chose —
// they are the token, spelled as a number, so the name is available and unused.
// 16 is spacing `md`, 6 is radius `md`.
//
// All four forms are here because they are four separate regexes: a JSX prop
// with a braced value, a JSX prop with a quoted value, an inline-style spacing
// key, and an inline-style radius key. Fixing one branch and leaving another is
// the failure this tier keeps producing.
export function OnScaleSpacing() {
  return (
    <div style={{ padding: 16, borderRadius: 6 }}>
      <section gap={16} />
      <section radius="6px" />
    </div>
  );
}
