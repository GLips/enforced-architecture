// The boundary itself: a real server function, not a mention of one.
import { createServerFn } from "@tanstack/react-start";
import { reserveInventory } from "../service/inventory.ts";

// LOOKS WRONG: the shorthand-looking key beside a genuine boundary is the point.
// `rebindsName` reads binding SHAPES out of text, and `{ createServerFn: … }` is
// an object literal binding nothing. A version that accepted a `:` after the name
// took this file out of the boundary and reported the barrel below it.
const boundaryLabel = { createServerFn: "@tanstack/react-start" };

export const placeOrder = createServerFn().handler(async () => {
  const reserved = await reserveInventory();
  return `${boundaryLabel.createServerFn}:${reserved}`;
});
