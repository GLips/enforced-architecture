// The five spellings someone reaches for once the obvious one is stopped.

// EXPECT: a computed lookup, which bundlers also fail to inline
const a = process["env"].STRIPE_KEY;

// EXPECT: reaching process off globalThis
const b = globalThis.process.env.STRIPE_KEY;

// EXPECT: destructuring env off process
const { env } = process;

// EXPECT: the bundler-specific form, a different CST shape entirely
const c = import.meta.env.VITE_PUBLIC_URL;

// EXPECT: importing env as a module rather than touching the global
import { env as nodeEnv } from "node:process";

export const reached = [a, b, env, c, nodeEnv];
