// LEGAL: a feature's error types at its root, beside its barrel. Silent.
//
// It sits at the same address as `helpers.ts` next door, which fires. What
// separates them is only the whitelist, so a check that closes feature roots by
// forbidding files there rejects this one too — and `errors.ts` at the feature
// root is what the directory model recommends.
export class ScannerError extends Error {
  readonly code = "scanner";
}
