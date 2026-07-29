// A test file may import whatever it likes — the rule governs production code.
import { seedDb } from "@/test/seed";
import { fakeRow } from "../__tests__/fixtures";
export const makeInvoice = () => [seedDb, fakeRow];
