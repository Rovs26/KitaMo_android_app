import { StyleSheet, Text, View } from "react-native";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import type { OwnerSetupStatus } from "@/services/ownerSetup";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type PilotStatusCardProps = {
  status: OwnerSetupStatus;
};

export function PilotStatusCard({ status }: PilotStatusCardProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const rows = [
    ["Local storage", status.dbReady ? "Ready" : "Checking"],
    ["Active business", status.activeBusiness?.businessName ?? "Not set"],
    ["Active stall", status.activeBranch?.branchName ?? "Not set"],
    ["Products", String(status.productCount)],
    ["Pending", String(status.pendingQueueCount)],
    ["Workspace", status.mode === "demo" ? "Demo" : "Fresh"],
  ] as const;

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: palette.text }]}>Pilot App Status</Text>
      <NetworkStatusBadge pendingQueueCount={status.pendingQueueCount} />
      <View style={styles.rows}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={[styles.label, { color: palette.mutedText }]}>{label}</Text>
            <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  title: {
    ...typography.heading,
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    flex: 1,
  },
  value: {
    ...typography.button,
    flex: 1,
    textAlign: "right",
  },
});
