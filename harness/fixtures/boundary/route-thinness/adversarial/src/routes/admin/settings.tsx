// EXPECT: the schema rather than the client, single-quoted, one directory deeper
import { invoices } from '@/infrastructure/db/schema/invoices';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyEnv = async () =>
  (await import("@/env.server")).env;

// EXPECT: a re-export carries the same dependency an import does
export { serverEnv } from "@/env.server";

export const Settings = () => invoices;
