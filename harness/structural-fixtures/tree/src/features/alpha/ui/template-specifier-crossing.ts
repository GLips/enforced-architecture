// FIRES import-policy: a dynamic import whose specifier is a template with
// NOTHING interpolated into it. It names one module statically and every
// bundler treats it as such, so a scanner that reads only string literals drops
// a real crossing. The interpolated form is the one the tier states it cannot
// see; this is not that form.
export async function loadBetaThing(): Promise<string> {
  const { betaThing } = await import(`../../beta/service/beta-thing.ts`);
  return betaThing;
}
