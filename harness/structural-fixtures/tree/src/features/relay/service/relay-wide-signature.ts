// FIRES trampolines: a forwarding function whose SIGNATURE spans lines, and
// whose body does too.
//
// A line-oriented matcher loses the boundary here twice over. It cannot read
// the parameter list off the declaration line, and it cannot tell where the
// body starts, so it either skips the function or tests text that is not its
// body — and in both cases reports nothing, which is indistinguishable from a
// function that earned its layer. Long signatures sit on the functions worth
// reading, so this is the shape a matcher can least afford to miss.
import { selectRelayRecords } from "../repo/relay-records.ts";

export function listRelayRecordsForViewer(
  viewerId: string,
  options: {
    includeArchived: boolean;
    limit: number;
  },
): Array<{ id: string; label: string }> {
  return selectRelayRecords().slice(
    0,
    options.limit,
  );
}
