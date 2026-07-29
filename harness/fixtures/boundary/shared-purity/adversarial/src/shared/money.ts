// EXPECT: single quotes, where a regex anchored on \" alone would miss
import { taxRate } from '@/domains/pricing';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyEnv = async () =>
  (await import("@/env")).env;

// EXPECT: a re-export carries the same dependency an import does
export { db } from "@/infrastructure/db";

// EXPECT: a bare alias root, where the pattern assumed a directory after it
import cfg from "@/config";

export const money = () => [taxRate, cfg];
