// FIRES single-component-export: an `export default function` beside an
// ordinary `export function`.
//
// The default export carries the smell here. A matcher spelled
// `export function Name(` matches `DefaultPairFooter` and nothing else, so this
// file scores one component and goes silent — the same clean run a file with a
// single component produces. Only the `default` clause tells the two apart.
export default function DefaultPairPanel() {
  return (
    <section>
      <DefaultPairFooter label="done" />
    </section>
  );
}

export function DefaultPairFooter({ label }: { label: string }) {
  return <footer>{label}</footer>;
}
