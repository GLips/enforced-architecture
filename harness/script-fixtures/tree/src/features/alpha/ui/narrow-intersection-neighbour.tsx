// LEGAL: seven props through an intersection, one under the threshold of eight,
// and it must stay silent.
//
// The legal neighbour for the base-resolving strategy, and it is one prop under
// the line rather than comfortably below it because each of the three ways this
// strategy over-counts adds only one or two:
//
//  1. `tone` is declared by the base AND narrowed by the intersecting literal.
//     TypeScript merges those into ONE prop; a counter that sums the two sides
//     without deduplicating by name reads eight and fires.
//  2. `model` is a MEMBER whose type is a named type declared in this same file.
//     Only the bases of the Props type expand — a counter that also expands
//     member types reads eleven. This is the shape the check exists to permit:
//     one prop carrying a model is the answer prop-count asks for, and a check
//     that reports it has argued against its own advice.
//  3. `layout` is one prop whose type is an object literal, and `children` is a
//     structural convention rather than a data dependency. Both were already
//     guarded for the plain type strategy and neither may lapse once a base is
//     merged in.
type NarrowRowModel = {
  rowId: string;
  label: string;
  tone: "info" | "warn";
  layout: { columns: number; dense: boolean; gutter: number };
  render: () => JSX.Element;
};

type NarrowIntersectionNeighbourProps = NarrowRowModel & {
  tone?: "info" | "warn";
  model: NarrowRowModel;
  onOpen: (id: string) => void;
  children?: React.ReactNode;
};

export function NarrowIntersectionNeighbour(props: NarrowIntersectionNeighbourProps) {
  return (
    <div data-tone={props.tone} data-columns={props.layout.columns}>
      <button type="button" onClick={() => props.onOpen(props.rowId)}>
        {props.label}
      </button>
      <span>{props.model.rowId}</span>
      {props.render()}
      {props.children}
    </div>
  );
}
