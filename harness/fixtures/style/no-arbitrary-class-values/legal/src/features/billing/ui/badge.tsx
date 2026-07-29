// Semantic token classes, which is what the rule points people to. `text-body`
// and `text-caption` are NOT on the framework's generic scale, and the layout
// utilities carry no value at all.
export const Badge = () => (
  <div className="text-body bg-surface p-m gap-s rounded-lg flex items-center" />
);

// A bracket class with no unit and no hex is an arbitrary VARIANT, not a raw
// value — the rule matches on the value shape, deliberately.
export const Peer = () => <div className="group-[.is-open]:block" />;
