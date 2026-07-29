// Relative imports within shared/, and external packages. That is the whole
// budget for a module at the bottom of the dependency graph.
import { pad } from "./pad";
import { clamp } from "./number/clamp";
import { format } from "date-fns";

export const formatDate = (d: Date) => format(d, String(clamp(pad(1))));
