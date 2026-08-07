// LEGAL: seven props through a named XProps interface, one under the threshold
// of eight, and it must stay silent.
//
// narrow-neighbour.tsx guards over-counting in the destructure strategy; this is
// the same guard for the type strategy, which has two ways of its own to
// over-count and share none of the destructure's:
//
//  1. `layout` is one prop whose type is an object literal. A counter that
//     scores every `name:` in the body rather than every TOP-LEVEL member reads
//     the three nested fields as three more props.
//  2. `children` is a structural convention, not a data dependency, and is
//     excluded here exactly as it is in the destructure.
//
// Seven counted, eleven if either goes wrong — far enough over to report, which
// is what makes this file worth keeping.
interface NarrowTypedNeighbourProps {
  rowId: string;
  label: string;
  tone: "info" | "warn";
  layout: { columns: number; dense: boolean; gutter: number };
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  render: () => JSX.Element;
  children: React.ReactNode;
}

export function NarrowTypedNeighbour(props: NarrowTypedNeighbourProps) {
  return (
    <div data-tone={props.tone} data-columns={props.layout.columns}>
      <button type="button" onClick={() => props.onOpen(props.rowId)}>
        {props.label}
      </button>
      <button type="button" onClick={() => props.onClose(props.rowId)}>
        close
      </button>
      {props.render()}
      {props.children}
    </div>
  );
}
