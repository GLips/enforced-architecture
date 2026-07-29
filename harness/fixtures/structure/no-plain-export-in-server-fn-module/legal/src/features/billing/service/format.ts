// No createServerFn in this module, so a plain export leaks nothing extra and
// the rule stays out of the way.
export function formatCents(n: number) {
  return `${n / 100}`;
}
