// controllers/, repo/, service/ and infrastructure/ are all server contexts.
import { auditLog } from "@/features/audit/index.server";
export const charge = () => auditLog();
