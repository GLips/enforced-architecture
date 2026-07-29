import { theme } from "@/shared/ui/theme";

export const styles = {
  // Tokens, which is the whole point of the rule.
  color: "var(--app-text-secondary)",
  background: theme.colors.surface,
};

// A fragment identifier is not a colour, and neither is a hash that carries
// too few hex digits or a non-hex character.
export const Anchor = () => <a href="#section-2" id="#top" data-key="#zebra" />;
