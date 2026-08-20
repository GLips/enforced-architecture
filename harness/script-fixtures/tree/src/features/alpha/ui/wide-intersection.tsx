// FIRES prop-count: eight props, seven of them declared to the LEFT of the brace.
//
// `type XProps = Model & { … }` is the ordinary way to say "everything the model
// carries, plus the callback". A check that reads the prop surface as the members
// between the first `{` after the name and its match sees ONE member here and
// scores this component at 1 — under any threshold, silent, and silent in the
// direction that matters, because the intersection is the spelling a component
// reaches for precisely WHEN its surface has grown wide enough to want a name.
//
// Eight is the threshold rather than comfortably past it, so a fix that resolves
// the base but drops or doubles a member of it shows up here as well.
//
// `wide-extends.tsx` is the same blind spot through the interface spelling. One
// does not prove the other: the base is in a heritage clause there and in a type
// expression here, and a fix can easily reach only one of them.
type WideIntersectionModel = {
  headline: string;
  summary: string;
  tone: "info" | "warn";
  rows: readonly string[];
  steps: readonly string[];
  notes: readonly string[];
  imageUri: string | undefined;
};

type WideIntersectionProps = WideIntersectionModel & {
  onScanAnother: () => void;
};

export function WideIntersection(props: WideIntersectionProps) {
  return (
    <section data-tone={props.tone}>
      <h2>{props.headline}</h2>
      <p>{props.summary}</p>
      <img alt={props.headline} src={props.imageUri} />
      <ul>
        {props.rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <ol>
        {props.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {props.notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
      <button type="button" onClick={props.onScanAnother}>
        again
      </button>
    </section>
  );
}
