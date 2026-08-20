// The fixture tree's `arch.config.ts`.
//
// It is also the worked example of item 3 of the tier's contract: adopting these
// checks in a new codebase is writing a file like this one, not editing a
// constant inside a check body. Everything the tree needs that differs from the
// catalog defaults is visible here, as a whole value replacing a whole value.
//
// Two overrides are worth reading before the rest:
//
//   - `health/file-size` scans a SECOND root, `packages/core/src`. A check
//     pointed at a root that does not exist returns cleanly by design, so an
//     unexercised root is indistinguishable from a working one. The tree carries
//     a fixture in that root for exactly that reason.
//   - `style/token-equality` imports its scales from the tree's own theme module
//     rather than restating them. That import IS the seam the rule exists for:
//     the enforcer cannot drift from the scale it guards if it reads it.

import { resolve } from "node:path";
import {
  type ArchitectureConfig,
  defaultCheckConfigs,
  defaultSourceConfig,
} from "../../skills/enforced-architecture/references/lint/structural/config.ts";
import { radius, spacing } from "./tree/src/shared/ui/theme.ts";

export const FIXTURE_TREE = resolve(import.meta.dir, "tree");

export const fixtureConfig: ArchitectureConfig = {
  projectRoot: FIXTURE_TREE,
  source: defaultSourceConfig,
  checks: {
    ...defaultCheckConfigs,

    "health/file-size": {
      ...defaultCheckConfigs["health/file-size"],
      roots: ["src", "packages/core/src"],
    },

    "placement/topology": {
      ...defaultCheckConfigs["placement/topology"],
      // The two source-root files the boundary fixtures need. A file directly in
      // the source root is not a layer, and naming each one here rather than
      // widening `allowedRoots` is the distinction this check exists to hold.
      allowedRootFiles: [
        ...defaultCheckConfigs["placement/topology"].allowedRootFiles,
        "entry-neighbour.ts",
        "root-neighbour.ts",
      ],
    },

    "style/token-equality": {
      ...defaultCheckConfigs["style/token-equality"],
      spacingScale: spacing,
      radiusScale: radius,
      exemptPaths: [
        ...defaultCheckConfigs["style/token-equality"].exemptPaths,
        // The scale's own home defines the raw values, which is what a token is.
        /^shared\/ui\/theme\.ts$/,
      ],
    },
  },
};
