// LEGAL: a service function that earns its layer. Silent.
//
// `const` for the validated input and `if` for the policy check are the two
// behaviour keywords keeping it quiet — drop either and the body is a forward
// with extra steps, which is the judgement the rule is making.
//
// The object-literal return type is the second thing this fixture holds. Read
// as the body, it is a run of type members with no keyword in it, so the check
// would report a function that plainly has behaviour — an over-match no
// positive case can see.
import { selectRelayRecord } from "../repo/relay-records.ts";

export function getRelayRecordForViewer(
  viewerId: string,
  id: string,
): { record: { id: string; label: string } | null; denied: boolean } {
  const trimmed = id.trim();
  if (viewerId.length === 0) return { record: null, denied: true };

  return { record: selectRelayRecord(trimmed), denied: false };
}
