// FIRES single-component-export: two components in one file, deliberately in
// the two spellings that are easiest to miss.
//
// `SecondaryBadge` is a zero-parameter arrow — the shape a matcher keyed on
// `export function Name(` never sees, and the shape most likely to get tucked
// in beside a real component because it feels too small for its own file.
// `PrimaryPanel` is the ordinary declaration.
export function PrimaryPanel({ title }: { title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      <SecondaryBadge />
    </section>
  );
}

export const SecondaryBadge = () => <span>badge</span>;
