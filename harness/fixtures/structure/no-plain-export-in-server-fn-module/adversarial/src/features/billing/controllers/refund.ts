import { createMiddleware } from "@tanstack/react-start";
import { auth } from "@/infrastructure/auth/auth-instance.server";

export const authed = createMiddleware().server(({ next }) =>
  next({ context: { auth } }),
);

// EXPECT+1: an explicit return type
export function label(n: number): string {
  return String(n);
}

// EXPECT+1: async function
export async function reload(): Promise<void> {}

// EXPECT+1: exported object
export const policy = {
  getSession: auth.api.getSession,
};

// EXPECT+1: exported class retains the server-only binding
export class AuthAccess {
  getSession() {
    return auth.api.getSession;
  }
}

// EXPECT+1: default export
export default function fallback(n: number) {
  return n;
}

// EXPECT+1: arrow export
export const arrowHelper = (n: number) => n * 2;

function laterHelper() {
  return auth.api.getSession;
}
type SessionReader = typeof laterHelper;

// EXPECT: later export list retains the server-only binding
export { laterHelper };

// EXPECT: mixed list still carries a runtime export
export { type SessionReader, laterHelper as readSession };

// EXPECT: named runtime re-export
export { audit } from "./audit.server";

// EXPECT: star runtime re-export
export * from "./roles.server";
