// LEGAL-BY-SCOPING: an import of a loose file at the features root, which
// `classify` reads as a feature named `orphan-module.ts`.
//
// The importee end of this edge is a feature name that is not a directory, so
// the grant file it would be denied against is
// `features/orphan-module.ts/visibility.json` — a path nobody can create, and a
// blocking finding nobody can clear. It must NOT produce a finding, and no
// `legal` entry can say so: the path the defect files at cannot exist in the
// tree, so the multiset catches it as SPURIOUS instead.
//
// `placement/topology` already reports the loose file itself, which is the
// finding a reader can act on.
import { orphanModule } from "@/features/orphan-module.ts";

export const reached = orphanModule;
