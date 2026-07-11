import { NetworkStateType, useNetworkState } from "expo-network";
import { StyleSheet, Text, View } from "react-native";

import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type NetworkStatusBadgeProps = {
  pendingQueueCount: number;
  compact?: boolean;
};

export function NetworkStatusBadge({ pendingQueueCount, compact = false }: NetworkStatusBadgeProps) {
  const networkState = useNetworkState();
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const offline =
    networkState.type === NetworkStateType.NONE ||
    networkState.isConnected === false ||
    networkState.isInternetReachable === false;
  const online = networkState.isConnected === true && networkState.isInternetReachable !== false;
  const statusLabel = online ? "Online · Local-only" : offline ? "Offline · Local mode" : "Local mode";

  return (
    <View
      style={[
        styles.container,
        compact ? styles.compactContainer : null,
        {
          backgroundColor: offline ? palette.background : palette.surface,
          borderColor: offline ? palette.warning : palette.border,
        },
      ]}
    >
      <Text style={[styles.status, { color: offline ? palette.warning : palette.text }]}>{statusLabel}</Text>
      <Text style={[styles.pending, { color: palette.mutedText }]}>
        {compact ? `${pendingQueueCount} local saves` : `Local save queue: ${pendingQueueCount}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  compactContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  status: {
    ...typography.button,
  },
  pending: {
    fontSize: 13,
    lineHeight: 18,
  },
});
