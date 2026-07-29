// Importing and CALLING a server function from a client component is the
// ordinary way to use one. Only DEFINING it outside controllers/ is restricted,
// so the bare identifier appearing here must not be reported.
import { createServerFn } from "@tanstack/react-start";
import { charge } from "@/features/billing/controllers/charge";

export const Panel = () => [charge(), typeof createServerFn];
