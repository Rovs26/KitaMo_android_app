import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.phase, { color: palette.accent }]}>KitaMo</Text>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.description, { color: palette.mutedText }]}>{description}</Text>

      {links.length > 0 ? (
        <View style={styles.links}>
          {links.map((link) => (
            <Link key={link.label} href={link.href} asChild>
              <Pressable style={[styles.linkButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                <Text style={[styles.linkText, { color: palette.primary }]}>{link.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  phase: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
  },
  links: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  linkButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  linkText: {
    ...typography.button,
  },
});
