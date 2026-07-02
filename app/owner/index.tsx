import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PilotStatusCard } from "@/components/owner/PilotStatusCard";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function OwnerHomeScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setCurrentMode = useAppStore((state) => state.setCurrentMode);
  const setActiveBusinessId = useAppStore((state) => state.setActiveBusinessId);
  const setActiveBranchId = useAppStore((state) => state.setActiveBranchId);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadStatus() {
        try {
          const nextStatus = await loadOwnerSetupStatus();
          if (!active) {
            return;
          }

          setStatus(nextStatus);
          setActiveBusinessId(nextStatus.activeBusiness?.id ?? null);
          setActiveBranchId(nextStatus.activeBranch?.id ?? null);
          setCurrentMode("owner");
          setError(null);
        } catch (loadError) {
          if (active) {
            setError(loadError instanceof Error ? loadError.message : "Could not load owner setup.");
          }
        }
      }

      loadStatus();

      return () => {
        active = false;
      };
    }, [setActiveBranchId, setActiveBusinessId, setCurrentMode]),
  );

  const setupRows = status
    ? [
        ["Business profile", status.activeBusiness ? "Created" : "Missing"],
        ["Store or stall", status.stallCount > 0 ? "Created" : "Missing"],
        ["Products", String(status.productCount)],
        ["Active stall", status.activeBranch?.branchName ?? "Not set"],
        ["Local database", status.dbReady ? "Ready" : "Checking"],
        ["Pending queue", String(status.pendingQueueCount)],
      ]
    : [];

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>Owner Mode</Text>
        <Text style={[styles.title, { color: palette.text }]}>Setup Home</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          Build the local business, stall, and product foundation before selling.
        </Text>
      </View>

      {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Local Setup Status</Text>
        {status ? (
          <View style={styles.statusRows}>
            {setupRows.map(([label, value]) => (
              <View key={label} style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: palette.mutedText }]}>{label}</Text>
                <Text style={[styles.statusValue, { color: palette.text }]}>{value}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.body, { color: palette.mutedText }]}>Loading local setup...</Text>
        )}
      </View>

      <View style={styles.nextActions}>
        <NextActionCard
          href="/owner/settings"
          title="Create Business Profile"
          description={status?.activeBusiness ? status.activeBusiness.businessName : "Add business name, owner, contact, and location."}
        />
        <NextActionCard
          href="/owner/settings"
          title="Add Store/Stall"
          description={status && status.stallCount > 0 ? `${status.stallCount} local stall record(s)` : "Add your first stall or store."}
        />
        <NextActionCard
          href="/owner/inventory"
          title="Add First Product"
          description={status && status.productCount > 0 ? `${status.productCount} product(s) saved locally` : "Add your first paninda."}
        />
        <NextActionCard href="/kiosk" title="Open Kiosk later" description="Kiosk routes are placeholders in this phase." />
      </View>

      {status ? <PilotStatusCard status={status} /> : null}
    </ScrollView>
  );
}

type NextActionCardProps = {
  href: "/owner/settings" | "/owner/inventory" | "/kiosk";
  title: string;
  description: string;
};

function NextActionCard({ href, title, description }: NextActionCardProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Link href={href} asChild>
      <Pressable style={[styles.actionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.actionTitle, { color: palette.primary }]}>{title}</Text>
        <Text style={[styles.actionDescription, { color: palette.mutedText }]}>{description}</Text>
      </Pressable>
    </Link>
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
  error: {
    ...typography.body,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
  },
  statusRows: {
    gap: spacing.sm,
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
  nextActions: {
    gap: spacing.sm,
  },
  actionCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  actionTitle: {
    ...typography.button,
  },
  actionDescription: {
    ...typography.body,
  },
});
