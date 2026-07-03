import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

type OwnerActionHref = "/owner/settings" | "/owner/inventory" | "/owner/records" | "/kiosk";

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
          logDevError("OwnerHome.loadStatus", loadError);
          if (active) {
            setError(getFriendlyErrorMessage("Could not load your local workspace."));
          }
        }
      }

      loadStatus();

      return () => {
        active = false;
      };
    }, [setActiveBranchId, setActiveBusinessId, setCurrentMode]),
  );

  const setupComplete = Boolean(status?.activeBusiness && status.activeBranch && status.productCount > 0);
  const activeBusiness = status?.activeBusiness?.businessName ?? "No business profile yet";
  const activeBranch = status?.activeBranch?.branchName ?? "No active stall yet";

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.brand, { color: palette.primary }]}>KitaMo</Text>
          <Text style={[styles.greeting, { color: palette.text }]}>Magandang araw</Text>
        </View>
        <Text style={[styles.subtle, { color: palette.mutedText }]}>Owner dashboard</Text>
      </View>

      {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}

      <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={[styles.cardLabel, { color: palette.accent }]}>Active workspace</Text>
            <Text style={[styles.businessName, { color: palette.text }]}>{activeBusiness}</Text>
            <Text style={[styles.subtle, { color: palette.mutedText }]}>{activeBranch}</Text>
          </View>
          <View style={[styles.queuePill, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.queueValue, { color: palette.primary }]}>{status?.pendingQueueCount ?? 0}</Text>
            <Text style={[styles.queueLabel, { color: palette.mutedText }]}>pending</Text>
          </View>
        </View>
        <NetworkStatusBadge pendingQueueCount={status?.pendingQueueCount ?? 0} />
      </View>

      {!status ? (
        <View style={[styles.setupCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Loading</Text>
          <Text style={[styles.subtle, { color: palette.mutedText }]}>Checking your local workspace.</Text>
        </View>
      ) : !setupComplete ? (
        <View style={[styles.setupCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Finish setup</Text>
          <View style={styles.setupRows}>
            <SetupRow label="Business profile" ready={Boolean(status.activeBusiness)} />
            <SetupRow label="Store or stall" ready={status.stallCount > 0} />
            <SetupRow label="Products" ready={status.productCount > 0} value={`${status.productCount} saved`} />
          </View>
        </View>
      ) : (
        <View style={[styles.setupCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Today</Text>
          <View style={styles.summaryGrid}>
            <SummaryTile label="Products" value={status ? String(status.productCount) : "..."} />
            <SummaryTile label="Stalls" value={status ? String(status.stallCount) : "..."} />
            <SummaryTile label="Mode" value={status?.mode === "demo" ? "Demo" : "Fresh"} />
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <OwnerActionCard
          href="/owner/settings"
          title="Business Profile"
          description={status?.activeBusiness ? "Edit business and stall details." : "Add business and stall details."}
        />
        <OwnerActionCard
          href="/owner/inventory"
          title="Products"
          description={status && status.productCount > 0 ? `${status.productCount} products ready.` : "Add your first paninda."}
        />
        <OwnerActionCard href="/kiosk" title="Open Kiosk" description="Start selling in Kiosk Mode." highlight />
        <OwnerActionCard href="/owner/records" title="Records" description="Review local sales records." />
      </View>
    </ScrollView>
  );
}

type SetupRowProps = {
  label: string;
  ready: boolean;
  value?: string;
};

function SetupRow({ label, ready, value }: SetupRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.setupRow}>
      <Text style={[styles.setupLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.setupValue, { color: ready ? palette.success : palette.warning }]}>
        {value ?? (ready ? "Ready" : "Needed")}
      </Text>
    </View>
  );
}

type SummaryTileProps = {
  label: string;
  value: string;
};

function SummaryTile({ label, value }: SummaryTileProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={[styles.summaryTile, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.summaryValue, { color: palette.primary }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: palette.mutedText }]}>{label}</Text>
    </View>
  );
}

type OwnerActionCardProps = {
  href: OwnerActionHref;
  title: string;
  description: string;
  highlight?: boolean;
};

function OwnerActionCard({ href, title, description, highlight = false }: OwnerActionCardProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Link href={href} asChild>
      <Pressable
        style={[
          styles.actionCard,
          {
            backgroundColor: highlight ? palette.primary : palette.surface,
            borderColor: highlight ? palette.primary : palette.border,
          },
        ]}
      >
        <Text style={[styles.actionTitle, { color: highlight ? palette.kioskHeaderText : palette.text }]}>{title}</Text>
        <Text style={[styles.actionDescription, { color: highlight ? palette.kioskHeaderText : palette.mutedText }]}>
          {description}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  header: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  brand: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  subtle: {
    ...typography.body,
  },
  error: {
    ...typography.body,
  },
  heroCard: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  heroTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  cardLabel: {
    ...typography.label,
  },
  businessName: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  queuePill: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  queueValue: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  queueLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  setupCard: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
  },
  setupRows: {
    gap: spacing.sm,
  },
  setupRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  setupLabel: {
    ...typography.body,
    flex: 1,
  },
  setupValue: {
    ...typography.button,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  summaryTile: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 68,
    padding: spacing.sm,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  summaryLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionCard: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 104,
    padding: spacing.md,
  },
  actionTitle: {
    ...typography.button,
  },
  actionDescription: {
    ...typography.body,
  },
});
