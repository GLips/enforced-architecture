// The wrapper module MUST import the original — it is the one file that may.
import { Textarea as Base } from "@mantine/core";

export const Textarea = (p: Record<string, unknown>) => <Base {...p} />;
