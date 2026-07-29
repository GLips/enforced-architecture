// The directories the deprecated path was split into.
import { Button } from "@/shared/ui/button";
import { InvoiceRow } from "@/features/billing/ui/row";

// A top-level directory whose name merely starts the same way.
import { registry } from "@/components-registry/index";

export const Panel = () => [Button, InvoiceRow, registry];
