// Reading the validated config the env module exports.
import { env } from "@/env";
import { cwd } from "node:process";

// An unrelated object with an `env` property. A rule that fires here would get
// an exclusion list bolted on instead of being fixed.
const deployTarget = { env: "production", region: "us-east-1" };
const label = deployTarget.env;
const runtimeVersion = process["version"];

// Destructuring `env` off something that is not `process`.
const { env: targetEnv } = deployTarget;

export const charge = () => [env.stripeKey, label, targetEnv, runtimeVersion, cwd()];
