// Pure code that looks like the violation. A rule that fires here is worse
// than no rule, because the exclusion list gets bolted on instead of the fix.

// A type import pulls in no runtime value: the shape of a thing is not the thing.
import type { LanguageModel } from "ai";
export type { Stats } from "node:fs";

// Relative imports stay inside the domain layer.
import { normalise } from "./normalise";
import { scoreRisk } from "../risk/score";
import { clamp } from "@/shared/math";

// A sibling domain by alias is the one cross-layer import a domain may make.
import { tierFor } from "@/domains/billing";

export const decide = (model: LanguageModel, input: string) =>
  tierFor(clamp(scoreRisk(normalise(input)))) + String(model);
