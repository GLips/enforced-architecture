// The forward edge's target, and a leaf. Together with `billing/errors.ts` it is
// what keeps the direct cycle a property of the domain graph alone.
export class UsageError extends Error {}
