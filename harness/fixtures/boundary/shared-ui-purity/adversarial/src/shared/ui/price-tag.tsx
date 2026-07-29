// EXPECT: the domain layer, single-quoted
import { taxRate } from '@/domains/pricing';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyDb = async () =>
  (await import("@/infrastructure/db")).db;

// EXPECT: a re-export carries the same dependency an import does
export { Route } from "@/routes/dashboard";

// EXPECT: the bare layer barrel with no path segment after it
import infra from "@/infrastructure";

export const PriceTag = () => [taxRate, infra];
