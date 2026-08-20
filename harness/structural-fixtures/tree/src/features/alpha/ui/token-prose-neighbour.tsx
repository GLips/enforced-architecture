// LEGAL: token-equal numbers that are prose rather than a styling decision.
// Silent.
//
// The comment you are reading spells the violation out — gap={16} and
// padding: 16 are verbatim what the check fires on — so it reports twice the
// moment comment blanking stops happening. This check blocks, and the file whose
// header explains the rule is the one people copy, so a check that reads its own
// documentation as a violation fails the commit that documents it.
//
// The string below carries the same numbers without the shapes. 16 is spacing
// `md` and 6 is radius `md`, and both must stay silent: the rule matches a
// spacing decision, never a digit that happens to equal a token.
export function TokenProseNeighbour() {
  const caption = "Cards sit at 16 with a 6 corner — spell both as md.";
  return <p>{caption}</p>;
}
