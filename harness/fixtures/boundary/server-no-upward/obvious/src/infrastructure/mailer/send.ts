// EXPECT+1: infrastructure consuming the feature layer it is meant to serve
import { renderInvoice } from "@/features/billing";

export const send = () => renderInvoice();
