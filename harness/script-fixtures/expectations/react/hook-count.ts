import type { CheckFixtures } from "../../expectations.ts";

export const hookCountFixtures: CheckFixtures = {
  check: "react/hook-count",

  // Eight hooks, one per line, none annotated. Nothing about this file is
  // clever, which is the point: a miss here is a check that stopped running.
  obvious: ["WARN src/features/alpha/ui/eight-hooks.tsx"],

  adversarial: [
    // Reaches seven only if BOTH hooks on the `onOpen`/`onShut` line are counted
    // AND the generic type arguments on `useState<string | null>` and
    // `useRef<HTMLDivElement>` are tolerated. Either gap alone scores six and
    // the file goes silent — under the threshold, indistinguishable from a pass.
    "WARN src/features/alpha/ui/many-hooks.tsx",
    // The other two configured roots. `targetDirs` names three, and a check
    // pointed at a root it never walks returns cleanly by design, so a root
    // nothing exercises is indistinguishable from a working one.
    "WARN src/routes/many-hooks-route.tsx",
    "WARN src/shared/ui/many-hooks-shared.tsx",
  ],

  legal: [
    // One under the threshold. An over-count of exactly one is the likeliest
    // arithmetic mistake and no positive case can see it.
    "src/features/alpha/ui/six-hooks-neighbour.tsx",
    // Eight hook calls in the file, seven of them consolidated into a custom
    // hook — the fix this rule asks for. Reporting it is the over-match that
    // teaches people the warning is noise.
    "src/features/alpha/ui/extracted-hook-neighbour.tsx",
  ],
};
