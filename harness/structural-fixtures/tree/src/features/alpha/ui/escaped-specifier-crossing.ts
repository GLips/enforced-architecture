// FIRES import-policy: the specifier is written as a unicode escape, so the
// COOKED path the scanner returns matches no literal in the text. Nothing here
// may look a specifier back up in the source — not to resolve it and not to
// place it on a line.
//
// This one still reports without the cooked value, because the escape is in the
// filename and the boundary is decided by the directories above it. The fixtures
// that bite are `features/escapade`, `travesty` and `masque`, where the same
// escape sits on a barrel-purity HOP and an uncooked specifier ends the trace.
import "../../beta/service/beta-thin\u0067.ts";

export const escaped = true;
