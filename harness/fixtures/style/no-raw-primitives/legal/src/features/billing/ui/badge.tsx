// The app's own primitives, including one that shares a NAME with a react-native
// primitive. The rule keys on the import, not the identifier, exactly so this
// stays legal.
import { Box, Stack, Text } from "@/shared/ui";

// Utility APIs from react-native are fine in feature code: only the rendering
// primitives are the design system's to own.
import { Platform, StyleSheet, useWindowDimensions } from "react-native";

// A type-only import pulls in no runtime component.
import type { View } from "react-native";

export const Badge = () => (
  <Box>
    <Stack>
      <Text>{Platform.OS}</Text>
    </Stack>
  </Box>
);
export const styles = [StyleSheet, useWindowDimensions];
export type Ref = View;
