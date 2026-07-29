// NEGATIVE SPACE, and it is deliberate: this template governs top-level files
// in src/shared/ only, so a nested shared module is NOT covered. The header and
// the Adapt section both say so, and Adapt option 1 offers `.*/src/shared/.*`
// for projects that nest. This fixture exists so the limit is a tested fact
// rather than something a reader discovers when a violation ships.
import { db } from "@/infrastructure/db";
import { billingLabel } from "@/features/billing";

export const format = () => [db, billingLabel];
