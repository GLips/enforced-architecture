// EXPECT: single quotes, where a regex anchored on \" alone would miss
import { Card } from '@/components/card';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyModal = async () =>
  (await import("@/components/modal")).Modal;

// EXPECT: a re-export carries the same dependency an import does
export { Badge } from "@/components/badge";

// EXPECT: a deeper path, where the pattern assumed one segment
import { Row } from "@/components/table/row";

export const Table = () => [Card, Row];
