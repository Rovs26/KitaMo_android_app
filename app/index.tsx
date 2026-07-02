import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { LocalDataVerificationPanel } from "@/components/common/LocalDataVerificationPanel";
import { useAppStore } from "@/state/appStore";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function WelcomeScreen() {
  const setCurrentMode = useAppStore((state) => state.setCurrentMode);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Android Phase 2 Local Data Foundation</Text>
        <Text style={styles.title}>KitaMo Android</Text>
        <Text style={styles.body}>
          Local-first Expo foundation for pilot-safe Owner and Kiosk flows. Fresh mode starts empty; demo data only appears
          after an explicit action.
        </Text>
      </View>

      <View style={styles.actions}>
        <Link href="/owner" asChild>
          <Pressable style={styles.primaryAction} onPress={() => setCurrentMode("owner")}>
            <Text style={styles.primaryActionText}>Open Owner Placeholder</Text>
          </Pressable>
        </Link>

        <Link href="/kiosk" asChild>
          <Pressable style={styles.secondaryAction} onPress={() => setCurrentMode("kiosk")}>
            <Text style={styles.secondaryActionText}>Open Kiosk Placeholder</Text>
          </Pressable>
        </Link>
      </View>

      <LocalDataVerificationPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  hero: {
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: "#806018",
  },
  title: {
    ...typography.display,
    color: "#18352B",
  },
  body: {
    ...typography.body,
    color: "#34423D",
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#1F6B4A",
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryActionText: {
    ...typography.button,
    color: "#FFFDF7",
  },
  secondaryAction: {
    alignItems: "center",
    borderColor: "#C69B2D",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    ...typography.button,
    color: "#18352B",
  },
});
