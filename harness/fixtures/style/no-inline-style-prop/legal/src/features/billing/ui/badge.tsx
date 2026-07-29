import { styles } from "./badge.styles";

// Token props on the primitive, which is the refactor the rule asks for.
export const Badge = () => <Box padding="m" gap="s" color="text-secondary" />;

// A named stylesheet entry passed by reference is not an inline object, and
// the rule says so deliberately: `style={someVar}` is out of scope.
export const Row = () => <Box style={styles.row} />;

declare function Box(p: Record<string, unknown>): null;
