// Production modules whose names merely contain the word, and shared helpers
// that live in production directories exactly so both sides can use them.
import { latestRate } from "@/shared/rates";
import { attestation } from "./attestation";
import { protestBanner } from "../ui/protest";

export const charge = () => [latestRate, attestation, protestBanner];
