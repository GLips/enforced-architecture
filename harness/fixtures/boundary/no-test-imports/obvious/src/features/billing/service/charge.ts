// EXPECT+1: production code importing a test module
import { makeInvoice } from "./charge.test";

export const charge = () => makeInvoice();
