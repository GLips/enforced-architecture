// FIRES import-policy: a sibling-feature crossing as a wrapped require().
// Goes quiet if extraction reads one line at a time.
export function loadSharedThing() {
  const { sharedThing } = require(
    "../../../shared/lib/shared-thing.ts"
  );
  return sharedThing;
}
