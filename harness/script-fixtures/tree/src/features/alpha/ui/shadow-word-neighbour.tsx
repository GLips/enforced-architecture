// LEGAL: three spellings of the word "shadow" that are not the property. Silent.
//
// `shadowRoot` is a DOM API, `data-shadow` is an attribute, and a class name is
// a class name. The word boundary in the pattern is the only thing keeping all
// three quiet, and widening to a bare substring of "shadow" is exactly what
// someone reaches for when a branch stops matching.
//
// Over-matching is invisible to every positive case, and on a blocking check it
// fails the commit on correct code — which is what teaches people to reach for
// the bypass rather than the inventory.
export function ShadowWordNeighbour({ host }: { host: HTMLElement }) {
  const attached = host.shadowRoot !== null;
  return (
    <div className="shadow-panel" data-shadow={attached}>
      alpha
    </div>
  );
}
