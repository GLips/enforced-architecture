// FIRES feature-visibility: an ungranted import whose importee is a symlink
// pointing OUT of the features directory.
//
// `aliased-link` next door is the same spelling problem with the target beside
// it; this is the one where the target is not in the tree at all — vendored
// code, or a package a monorepo hoisted. The enumeration lists directories, and
// a symlink is not one, so the resolved path matches nothing enumerated and a
// check that answers "not a feature" on that miss allows the edge in silence.
// It is deny-by-default with a hole in it, reachable by writing ordinary code.
//
// The ADDRESS is the second half of the assertion, and here it is the LINK
// rather than the target: `src/features/escaping-link/visibility.json` is a path
// the author can create — it lands in the vendored directory through the link —
// and `vendor/escaping-target/visibility.json` is not a path this tree's
// features/ vocabulary can even name. A finding nobody can clear is worth no
// more than the silence it replaces, which is why the loose file at the features
// root stays silent instead.
import { escapedValue } from "@/features/escaping-link/index.ts";

export const vendored = escapedValue;
