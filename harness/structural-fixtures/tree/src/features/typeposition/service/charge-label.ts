// The traced module. Its one mention of a server-only package is an import
// written in a type position, so the compiled output imports nothing.
type Charge = import("stripe").Charge;

export const chargeLabel = (charge: Charge): string => String(charge);
