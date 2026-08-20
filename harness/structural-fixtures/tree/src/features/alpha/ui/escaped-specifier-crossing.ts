// FIRES import-policy with no line number: the specifier is written as a
// unicode escape, so the reader's cooked path matches no literal in the text. The
// whole graph aborts if that case throws instead of reporting the file alone.
import "../../beta/service/beta-thin\u0067.ts";

export const escaped = true;
