import { theme } from "@/shared/ui/theme";

// A named size from the scale, which is what the rule points people to.
export const Badge = () => <Text size="caption" variant="heading-xs" />;

export const styles = {
  fontFamily: theme.typography.body,
  // Keys that merely contain or resemble the name.
  minFontSize: 12,
  fontSizeToken: "caption",
  lineHeight: 1.4,
};

declare function Text(p: { size: string; variant: string }): null;
