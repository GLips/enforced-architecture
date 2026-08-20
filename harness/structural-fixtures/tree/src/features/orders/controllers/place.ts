// The boundary itself: a real server function, not a mention of one.
import { createServerFn } from "@tanstack/react-start";
import { reserveInventory } from "../service/inventory.ts";

export const placeOrder = createServerFn().handler(async () => reserveInventory());
