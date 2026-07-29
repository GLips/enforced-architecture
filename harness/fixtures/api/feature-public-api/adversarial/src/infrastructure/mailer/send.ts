// EXPECT+1: infrastructure reaching into a feature at all inverts the layer direction
import { renderInvoice } from "@/features/billing/service/render";

export const send = () => renderInvoice();
