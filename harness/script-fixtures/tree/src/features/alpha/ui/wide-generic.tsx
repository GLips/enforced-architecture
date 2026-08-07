// FIRES prop-count: nine props on a generic component, declared the way real
// components are declared — the signature spans lines and the type is an inline
// literal rather than a named XProps.
//
// Three separate blind spots have to stay closed for this file to report:
//
//  1. The declaration must be found at all. A generic puts its type parameters
//     between the name and the paren, so `function Name(` does not match.
//  2. The parameter list must be accumulated ACROSS LINES. A pattern anchored
//     as `\(([^)]*)\)` needs the whole signature on one line, which no real
//     nine-prop component has, so it finds only components too small to fire.
//  3. The counted region must end at the destructure's own closing brace. The
//     inline type literal that follows repeats every name, and reading to the
//     last brace counts all of them a second time.
//
// Miss any one and this file goes quiet, which is the only reason it is worth
// keeping.
export function WideGeneric<T extends string>({
  items,
  selected,
  label,
  onSelect,
  onClear,
  onRetry,
  columns,
  dense,
  emptyText,
}: {
  items: T[];
  selected: T | null;
  label: string;
  // An arrow in a member type ends in `>`. A depth counter that treats that as
  // a closing bracket goes negative here and mis-splits everything after it.
  onSelect: (item: T) => void;
  onClear: () => void;
  onRetry: () => void;
  columns: Map<string, number>;
  dense?: boolean;
  emptyText?: string;
}) {
  return (
    <div data-dense={dense} data-columns={columns.size}>
      <button type="button" onClick={onClear}>
        {label}
      </button>
      <button type="button" onClick={onRetry}>
        retry
      </button>
      <ul>
        {items.map((item) => (
          <li key={item} onClick={() => onSelect(item)}>
            {item === selected ? emptyText : item}
          </li>
        ))}
      </ul>
    </div>
  );
}
