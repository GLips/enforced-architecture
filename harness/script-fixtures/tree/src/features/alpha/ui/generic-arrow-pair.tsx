// FIRES single-component-export: a generic component beside an arrow one —
// neither of the two components here is the shape a naive matcher looks for.
//
// `OptionList` puts its type-parameter list between the name and the paren, so
// a pattern expecting them adjacent skips it; `OptionRow` is the arrow the
// `function` keyword never reaches. Miss either clause and this file drops to
// one component or zero and reports nothing, which is indistinguishable from a
// file that was fine all along.
export function OptionList<T extends string>({ items }: { items: T[] }) {
  return (
    <ul>
      {items.map((item) => (
        <OptionRow key={item} label={item} />
      ))}
    </ul>
  );
}

export const OptionRow = ({ label }: { label: string }) => <li>{label}</li>;
