import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import { loadKioskContext, type KioskContext } from "@/services/kioskSales";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function KioskHomeScreen() {
  const [context, setContext] = useState<KioskContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setCurrentMode = useAppStore((state) => state.setCurrentMode);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function refresh() {
        try {
          const nextContext = await loadKioskContext();
          if (active) {
            setContext(nextContext);
            setCurrentMode("kiosk");
            setError(null);
          }
        } catch (loadError) {
          if (active) {
            setError(loadError instanceof Error ? loadError.message : "Could not load Kiosk.");
          }
        }
      }

      refresh();

      return () => {
        active = false;
      };
    }, [setCurrentMode]),
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>Kiosk Mode</Text>
        <Text style={[styles.title, { color: palette.text }]}>Selling counter</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          Local-only selling for the active business and stall. Staff security is pilot preview only.
        </Text>
      </View>

      {error ? <Text style={[styles.body, { color: palette.danger }]}>{error}</Text> : null}

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Kiosk readiness</Text>
        <NetworkStatusBadge pendingQueueCount={context?.pendingQueueCount ?? 0} />
        <StatusRow label="Business" value={context?.activeBusiness?.businessName ?? "Missing"} />
        <StatusRow label="Active stall" value={context?.activeBranch?.branchName ?? "Missing"} />
        <StatusRow label="Products ready" value={context ? String(context.products.length) : "Loading"} />
        <StatusRow label="Pending sync queue" value={context ? String(context.pendingQueueCount) : "Loading"} />
        <StatusRow label="Mode" value={context?.mode === "demo" ? "Demo data" : "Fresh"} />
        {context?.setupMessage ? <Text style={[styles.notice, { color: palette.warning }]}>{context.setupMessage}</Text> : null}
      </View>

      <View style={styles.actions}>
        {context?.canOpenKiosk ? (
          <Link href="/kiosk/sell" asChild>
            <Pressable style={[styles.primaryAction, { backgroundColor: palette.primary }]}>
              <Text style={[styles.primaryActionText, { color: palette.kioskHeaderText }]}>Open Sell Screen</Text>
            </Pressable>
          </Link>
        ) : null}

        {!context?.activeBusiness || !context.activeBranch ? (
          <Link href="/owner/settings" asChild>
            <Pressable style={[styles.secondaryAction, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              <Text style={[styles.secondaryActionText, { color: palette.primary }]}>Open Owner Settings</Text>
            </Pressable>
          </Link>
        ) : null}

        {context && context.activeBusiness && context.activeBranch && context.products.length === 0 ? (
          <Link href="/owner/inventory" asChild>
            <Pressable style={[styles.secondaryAction, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              <Text style={[styles.secondaryActionText, { color: palette.primary }]}>Add Products in Owner Inventory</Text>
            </Pressable>
          </Link>
        ) : null}

        <Link href="/kiosk/orders" asChild>
          <Pressable style={[styles.secondaryAction, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.secondaryActionText, { color: palette.primary }]}>Recent Orders</Text>
          </Pressable>
        </Link>
        <Link href="/kiosk/stock" asChild>
          <Pressable style={[styles.secondaryAction, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.secondaryActionText, { color: palette.primary }]}>Stock Check</Text>
          </Pressable>
        </Link>
        <Link href="/kiosk/shift" asChild>
          <Pressable style={[styles.secondaryAction, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.secondaryActionText, { color: palette.primary }]}>Shift Summary</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

type StatusRowProps = {
  label: string;
  value: string;
};

function StatusRow({ label, value }: StatusRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.statusRow}>
      <Text style={[styles.statusLabel, { color: palette.mutedText }]}>{label}</Text>
      <Text style={[styles.statusValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.label,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    marginBottom: spacing.xs,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  statusLabel: {
    ...typography.body,
    flex: 1,
  },
  statusValue: {
    ...typography.button,
    flex: 1,
    textAlign: "right",
  },
  notice: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryAction: {
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryActionText: {
    ...typography.button,
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    ...typography.button,
  },
});
