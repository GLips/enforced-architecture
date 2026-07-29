// shared/ui/ has its own, more permissive rule (shared-ui-purity), so this
// rule deliberately says nothing about it.
import { formatDate } from "@/shared/date";
export const Badge = () => formatDate(new Date());
