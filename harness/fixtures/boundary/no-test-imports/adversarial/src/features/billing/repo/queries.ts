// EXPECT: shared test infrastructure by alias, single-quoted
import { seedDb } from '@/test/seed';

// EXPECT: a __tests__ directory rather than a .test. filename
import { fakeRow } from "../__tests__/fixtures";

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazySeed = async () =>
  (await import("@/test/factories")).makeInvoice;

// EXPECT: a re-export carries the same dependency an import does
export { makeInvoice } from "../service/charge.test";

// EXPECT: the extensionless spelling, where the pattern assumed a trailing dot
import { helper } from "./queries.test";

export const q = [seedDb, fakeRow, helper];
