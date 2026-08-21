// The half of `mislaid` that is still on disk. It exists so the feature is
// OCCUPIED — an empty directory manufactures no feature — and so the module
// `stalepath` imports is missing from a feature that is otherwise ordinary,
// rather than from a directory that was never there.
export const stillHere = (): string => "here";
