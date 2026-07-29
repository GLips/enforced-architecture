// EXPECT+1: a deep import past the domain barrel
import { calculateTax } from "@/domains/pricing/calculate";

export const charge = (cents: number) => calculateTax(cents);
