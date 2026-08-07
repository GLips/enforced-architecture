// FIRES trampolines TWICE: two forwarding methods inside an exported object.
//
// Nothing in this file starts with `export function`, so an implementation that
// reads only the declaration form is silent here — and a service written as one
// exported namespace is common enough that "silent here" means silent across
// most of a codebase. The nested `options` object is the second half of the
// trap: its `withDefaults` method is not part of the exported surface, and a
// member test that ignores depth reports it as a third trampoline.
import { selectRelayRecord, selectRelayRecords } from "../repo/relay-records.ts";

export const relayNamespace = {
  getRelayRecord(id: string) {
    return selectRelayRecord(id);
  },

  listRelayRecords() {
    return selectRelayRecords();
  },

  options: {
    withDefaults(id: string) {
      const trimmed = id.trim();
      return { id: trimmed };
    },
  },
};
