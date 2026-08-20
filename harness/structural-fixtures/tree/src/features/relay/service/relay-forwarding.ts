// FIRES trampolines: a plain forwarding declaration, the shape the doc names.
//
// `getRelayThing` adds nothing to the call it passes down — no validation, no
// policy, no orchestration, no error mapping. It exists because the layer
// exists, which is the whole subject of the rule.
import { selectRelayRecord } from "../repo/relay-records.ts";

export function getRelayThing(id: string) {
  return selectRelayRecord(id);
}
