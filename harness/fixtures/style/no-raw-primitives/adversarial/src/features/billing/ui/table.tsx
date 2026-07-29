// EXPECT+1: with attributes AND children, not the bare self-closing shape
export const Row = () => <section className="row">{null}</section>;

// EXPECT+2: nested inside a legal primitive, where a top-level scan misses it
export const Cell = () => (
  <Box><span>text</span></Box>
);

// EXPECT: an aliased import, which the shorthand-specifier arm alone would miss
import { View as Screen } from "react-native";

// EXPECT: the shorthand form of the same import
import { Text } from "react-native";

declare function Box(p: { children?: unknown }): null;
export const used = [Screen, Text];
