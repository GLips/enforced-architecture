// LEGAL-BY-SUPPRESSION: an ungranted edge into a feature whose visibility.json
// does not parse. It must NOT produce a finding.
//
// A malformed file reports ITSELF once. Deriving deny-all violations from it as
// well would bury that one real error under every edge into the feature, and the
// person reading the output would fix the symptom rather than the JSON. If the
// suppression breaks, this edge surfaces as a second, spurious finding.
import { token } from "@/features/broken/index.ts";

export const echoed = token;
