// FIRES import-policy: a crossing inside a `${…}` interpolation. Goes quiet
// if template text is blanked wholesale rather than lexed.
export const describeBeta = async () =>
  `beta says ${(await import("../../beta/service/beta-thing.ts")).betaThing}`;
