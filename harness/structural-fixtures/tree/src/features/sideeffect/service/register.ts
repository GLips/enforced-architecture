// A bare `import "…"` has no specifiers, so "are all of this statement's
// specifiers type-only" is vacuously true of it. A side-effect import exists
// PRECISELY to be emitted, so reading that vacuous truth as `typeOnly` drops the
// most unambiguously runtime import there is — and every check that filters
// erased edges goes quiet on it at once.
import "postgres";

export const registerSideEffects = (): boolean => true;
