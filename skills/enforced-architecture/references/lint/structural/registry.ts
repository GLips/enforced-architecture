// ─── The structural-check manifest ────────────────────────────────────
//
// The list a consuming project copies whole. A check absent from it is a file
// nobody loads — implemented, fixtured, and never run — so the fixture harness
// loads this module rather than grepping for check names: a commented-out
// registration is invisible to a text search and not to an import.
//
// Nothing is dropped from this list on adoption. A check whose subject a tree
// does not have yet returns cleanly and starts reporting the day the tree grows
// one — a project with no `domains/` directory keeps `graph/domain-cycles` for
// the day it has one. Unregistering it buys the same quiet with no record that
// anyone decided, which reads as coverage that is not there. Where a check looks
// is set in `policy/declared-trees.ts` for the tree-scoped ones and in
// `arch.config.ts` for the two project-scoped ones, never here.
//
// Each check's id is declared inside the check itself as well as being the key
// to its documentation and its fixtures, so the three can be compared. A check
// whose id drifts from its filename reports findings under a label no
// expectation matches, which reads as a renamed check rather than a mistake.

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
