// FIRES topology: a file at a feature root, outside every layer directory.
//
// This one is adversarial because it sits INSIDE a governed directory. A
// whitelist that only checks the first path segment sees `features`, calls the
// path legal, and stops — while `layer-direction` and `layer-occupancy` scope to
// `features/<name>/(ui|controllers|service|repo)/` and never see this file
// either. It is governed by nothing, from inside the structure.
//
// It needs no cleverness to write: it is what someone produces when they need a
// place to put something and the structure does not say. If the feature-root
// branch regresses, the check stays green on the exact file its own doc names.
export function normaliseScannerInput(raw: string): string {
  return raw.trim().toLowerCase();
}
