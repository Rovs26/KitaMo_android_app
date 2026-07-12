import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

export const OWNER_CONTEXT_BAR_HEIGHT = 46;

export function OwnerContextBar({ mode }: { mode: "owner" | "kiosk" }) {
  const activeBusinessName = useAppStore((state) => state.activeBusinessName);
  const activeBranchName = useAppStore((state) => state.activeBranchName);
  const kioskSessionBranchId = useAppStore((state) => state.kioskSessionBranchId);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const router = useRouter();
  const kioskConfirmed = mode === "kiosk" && Boolean(kioskSessionBranchId && activeBranchName);
  const primaryLabel = activeBusinessName ?? "Choose a business";
  const secondaryLabel =
    mode === "kiosk"
      ? kioskConfirmed
        ? `Kiosk: ${activeBranchName}`
        : "Choose and confirm a stall"
      : activeBranchName
        ? `Active stall: ${activeBranchName}`
        : "No active stall selected";

  function openContextPicker() {
    if (mode === "kiosk") {
      router.replace("/kiosk");
      return;
    }

    router.push("/owner/context" as Href);
  }

  return (
    <Pressable
      accessibilityHint={mode === "kiosk" ? "Returns to the Kiosk stall picker" : "Opens business and stall switching"}
      accessibilityLabel={`${primaryLabel}. ${secondaryLabel}`}
      accessibilityRole="button"
      onPress={openContextPicker}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: mode === "kiosk" ? palette.softAccent : palette.softPrimary,
          borderColor: palette.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons color={palette.primary} name={mode === "kiosk" ? "storefront-outline" : "business-outline"} size={18} />
      <View style={styles.copy}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.primary, { color: palette.text }]}>
          {primaryLabel}
        </Text>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.secondary, { color: palette.mutedText }]}>
          {secondaryLabel}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={1.2} style={[styles.action, { color: palette.primary }]}>
        {mode === "kiosk" ? "Change" : "Switch"}
      </Text>
      <Ionicons color={palette.primary} name="chevron-forward" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    height: OWNER_CONTEXT_BAR_HEIGHT,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  primary: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 15,
  },
  secondary: {
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
  },
  action: {
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
  },
});

