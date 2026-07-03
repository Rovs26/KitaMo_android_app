import { type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type PlaceholderLink = {
  href: Href;
  label: string;
};

type PlaceholderScreenProps = {
  title: string;
  description: string;
  links?: PlaceholderLink[];
};

export function PlaceholderScreen({ title, description, links = [] }: PlaceholderScreenProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle={description} title={title} />
      <Card>
        <EmptyState description="This area is intentionally light for the local pilot." title={`${title} is coming soon`} />
        <Text style={[styles.description, { color: palette.mutedText }]}>{description}</Text>

        {links.length > 0 ? (
          <View style={styles.links}>
            {links.map((link) => (
              <SecondaryButton href={link.href} key={link.label} label={link.label} />
            ))}
          </View>
        ) : null}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  description: {
    ...typography.body,
  },
  links: {
    gap: spacing.sm,
  },
});
