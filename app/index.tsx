import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppStore } from "@/state/appStore";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function WelcomeScreen() {
  const setCurrentMode = useAppStore((state) => state.setCurrentMode);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Android Phase 1 Foundation</Text>
      <Text style={styles.title}>KitaMo Android</Text>
      <Text style={styles.body}>
        Local-first Expo foundation for the pilot-safe Owner and Kiosk flows. These screens are placeholders only.
      </Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
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
