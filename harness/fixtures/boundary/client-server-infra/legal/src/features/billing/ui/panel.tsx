// The two modules the allowlist names, which is the whole allowlist.
import { authClient } from "@/infrastructure/auth/client";
import { queryClient } from "@/infrastructure/providers/query-client";

export const Panel = () => [authClient, queryClient];
