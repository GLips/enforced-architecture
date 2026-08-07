// Support for the surface barrels. `createClient` is deliberately named the
// generic way a module names its own constructor, because that is what tempts a
// barrel into renaming it on the way out — the alias the violating barrel
// writes is the plausible one, not a contrived one.
export const surfaceClientVersion = 1;

export function createClient(): { ready: boolean; version: number } {
  const ready = surfaceClientVersion > 0;
  return { ready, version: surfaceClientVersion };
}
