// A .ts infrastructure wrapper is exactly where the global belongs, and the
// rule is scoped to .tsx for that reason.
export const apiFetch = (path: string) => fetch(path);
