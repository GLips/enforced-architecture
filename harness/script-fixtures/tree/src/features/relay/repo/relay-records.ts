// LEGAL: thin DB wrappers in the repo layer. Silent, and only because of where
// they sit.
//
// Every function here is a textbook trampoline by body — no declarations, no
// control flow, nothing but a forwarded call. Wrapping the query IS the repo
// layer's job, so `targetLayers` must never include it. If the layer scoping
// breaks, or the glob widens to the whole feature, this file starts reporting
// and the rule begins telling people to delete the layer below the one it
// watches.
const relayTable = {
  findById: (id: string) => ({ id, label: "relay" }),
  findAll: () => [{ id: "relay", label: "relay" }],
};

export function selectRelayRecord(id: string) {
  return relayTable.findById(id);
}

export function selectRelayRecords() {
  return relayTable.findAll();
}
