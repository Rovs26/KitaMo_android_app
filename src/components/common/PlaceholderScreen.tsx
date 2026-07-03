import { type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, IconBadge, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
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
  emptyTitle?: string;
  previewCards?: {
    title: string;
    description: string;
    icon: string;
  }[];
  links?: PlaceholderLink[];
};

export function PlaceholderScreen({ title, description, emptyTitle, previewCards = [], links = [] }: PlaceholderScreenProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle={description} title={title} />
      <Card>
        <EmptyState description={description} title={emptyTitle ?? `${title} is coming soon`} />
        <Text style={[styles.description, { color: palette.mutedText }]}>{description}</Text>

        {previewCards.length > 0 ? (
          <View style={styles.previewList}>
            {previewCards.map((card) => (
              <View key={card.title} style={[styles.previewCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <IconBadge label={card.icon} tone="primary" size="sm" />
                <View style={styles.previewText}>
                  <Text style={[styles.previewTitle, { color: palette.text }]}>{card.title}</Text>
                  <Text style={[styles.previewDescription, { color: palette.mutedText }]}>{card.description}</Text>
                </View>
                <Pill label="Soon" tone="neutral" />
              </View>
            ))}
          </View>
        ) : null}

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
  previewList: {
    gap: spacing.sm,
  },
  previewCard: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: 12,
  },
  previewText: {
    flex: 1,
    gap: spacing.xs,
  },
  previewTitle: {
    ...typography.button,
  },
  previewDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
