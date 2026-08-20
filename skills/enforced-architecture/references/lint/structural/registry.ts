// ─── The structural-check manifest ────────────────────────────────────
//
// The list a consuming project copies and prunes. A check absent from it is a
// file nobody loads — implemented, fixtured, and never run — so the fixture
// harness loads this module rather than grepping for check names: a
// commented-out registration is invisible to a text search and not to an import.
//
// Prune to what the project adopted. A check pointed at a root that does not
// exist returns cleanly by design, so an unadopted check left registered reads
// as coverage that is not there.
//
// Each check's id is declared inside the check itself as well as being the key
// to its documentation and its fixtures, so the three can be compared. A check
// whose id drifts from its filename reports findings under a label no
// expectation matches, which reads as a renamed check rather than a mistake.
//
// `boundary/import-policy` replaces `boundary/cross-boundary-alias` outright. That
// check reported a relative import whose two ends classified to different
// boundaries; this one hands EVERY relative edge to `lint/policy/import-policy.ts`
// and reports whatever comes back — the semantic denial when the edge is
// forbidden, the alias spelling when it is merely hidden. The boundary comparison
// is gone rather than kept alongside: `src/shared/ui/**` and `src/shared/**` are
// one boundary and two units, so the comparison could not see a real crossing,
// and any future nested profile would have the same hole.

import { barrelPurityCheck } from "./api/barrel-purity.ts";
import { barrelDiscoverabilityCheck } from "./naming/barrel-discoverability.ts";
import { importPolicyCheck } from "./boundary/import-policy.ts";
import { cssTokensCheck } from "./style/css-tokens.ts";
import { docBudgetsCheck } from "./health/doc-budgets.ts";
import { domainCyclesCheck } from "./graph/domain-cycles.ts";
import { featureDepsCheck } from "./graph/feature-deps.ts";
import { featureVisibilityCheck } from "./api/feature-visibility.ts";
import { fileSizeCheck } from "./health/file-size.ts";
import { layerDirectionCheck } from "./placement/layer-direction.ts";
import { layerOccupancyCheck } from "./boundary/layer-occupancy.ts";
import { shadowSourceCheck } from "./style/shadow-source.ts";
import { testFileMirrorCheck } from "./naming/test-file-mirror.ts";
import { tokenEqualityCheck } from "./style/token-equality.ts";
import { topologyCheck } from "./placement/topology.ts";
import { trampolinesCheck } from "./health/trampolines.ts";
import type { StructuralCheck } from "./check-substrate.ts";

export const structuralChecks: StructuralCheck[] = [
  barrelPurityCheck,
  featureVisibilityCheck,
  importPolicyCheck,
  layerOccupancyCheck,
  domainCyclesCheck,
  featureDepsCheck,
  fileSizeCheck,
  docBudgetsCheck,
  trampolinesCheck,
  barrelDiscoverabilityCheck,
  testFileMirrorCheck,
  layerDirectionCheck,
  topologyCheck,
  cssTokensCheck,
  shadowSourceCheck,
  tokenEqualityCheck,
];
