// LEGAL: a correctly-named `.mts` test sitting beside its `.mts` module.
// Over-matching here is the defect this check fails loudest with.
import { ledgers } from "./ledgers.mts";

export const covered = ledgers;
