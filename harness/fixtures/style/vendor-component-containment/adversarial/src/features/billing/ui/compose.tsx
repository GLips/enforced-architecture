// EXPECT+1: renamed on import, which the shorthand-specifier arm alone misses
import { Textarea as MantineTextarea } from "@mantine/core";

// EXPECT+3: alongside other specifiers, where a single-specifier pattern misses
import {
  Button,
  Textarea,
  Group,
} from '@mantine/core';

export const Compose = () => [MantineTextarea, Textarea, Button, Group];
