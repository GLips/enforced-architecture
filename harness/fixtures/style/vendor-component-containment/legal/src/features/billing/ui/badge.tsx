// The app wrapper, which carries the shared convention.
import { Textarea } from "@/shared/ui/textarea";

// Other components from the same library are not wrapped, so they are fine.
import { Button, Group, Stack } from "@mantine/core";

// A type-only import pulls in no runtime component.
import type { TextareaProps } from "@mantine/core";

// An identifier that merely starts the same way — the alternation is anchored
// end to end so `TextareaAutosize` is a different name, not a prefix match.
import { TextareaAutosize } from "@mantine/core";

export const Badge = () => [Textarea, Button, Group, Stack, TextareaAutosize];
export type Props = TextareaProps;
