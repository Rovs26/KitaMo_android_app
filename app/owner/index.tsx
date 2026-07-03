import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import {
  AppTopBar,
  Card,
  EmptyState,
  formatPeso,
  HeroCard,
  IconBadge,
  ListRow,
  MetricCard,
  Pill,
  PrimaryButton,
  ScreenScroll,
  SectionHeader,
  SecondaryButton,
} from "@/components/ui/KitaMoUI";
import { getKioskShiftSummary, listRecentKioskOrders, type KioskOrderSummary, type KioskShiftSummary } from "@/services/kioskSales";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

export default function OwnerHomeScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [summary, setSummary] = useState<KioskShiftSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<KioskOrderSummary[]>([]);
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
          const nextSummary = await getKioskShiftSummary();
          const orders = await listRecentKioskOrders(2);
          if (!active) {
            return;
          }

          setStatus(nextStatus);
          setSummary(nextSummary);
          setRecentOrders(orders);
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
  const activeBusiness = status?.activeBusiness?.businessName ?? "Set up your business";
  const activeBranch = status?.activeBranch?.branchName ?? "No active stall yet";
  const salesTotal = summary?.grossSales ?? 0;
  const pendingCount = status?.pendingQueueCount ?? 0;

  return (
    <ScreenScroll bottomNav>
      <AppTopBar
        right={<Pill label={status?.mode === "demo" ? "Demo" : "Fresh"} tone={status?.mode === "demo" ? "accent" : "success"} />}
        subtitle="Magandang araw!"
        title="Home"
      />

      {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}

      <View style={[styles.businessPill, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <IconBadge label="S" tone="primary" size="sm" />
        <Text style={[styles.businessPillText, { color: palette.text }]} numberOfLines={1}>
          {activeBusiness}
        </Text>
        <Text style={[styles.businessPillCaret, { color: palette.mutedText }]}>v</Text>
      </View>

      <HeroCard>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroLabel, { color: palette.kioskHeaderText }]}>{"Today's Kita"}</Text>
            <Text style={[styles.heroValue, { color: palette.kioskHeaderText }]}>{formatPeso(salesTotal)}</Text>
            <Text style={[styles.heroSubcopy, { color: palette.softAccent }]}>
              {salesTotal > 0 ? "Local sales saved today" : "No local sales yet today"}
            </Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: palette.softAccent }]}>
            <Text style={[styles.heroBadgeText, { color: palette.primary }]}>K</Text>
          </View>
        </View>
        <NetworkStatusBadge pendingQueueCount={pendingCount} compact />
      </HeroCard>

      <View style={styles.metricGrid}>
        <MetricCard detail={`${summary?.salesCount ?? 0} transactions`} icon="B" label="Benta" tone="primary" value={formatPeso(salesTotal)} />
        <MetricCard detail="No expenses yet" icon="G" label="Gastos" tone="danger" value={formatPeso(0)} />
        <MetricCard detail="Local gross view" icon="T" label="Tubo" tone="success" value={formatPeso(salesTotal)} />
        <MetricCard detail="Pending saves" icon="P" label="Pending" tone="accent" value={String(pendingCount)} />
      </View>

      {!status ? (
        <Card>
          <SectionHeader title="Loading" />
          <Text style={[styles.body, { color: palette.mutedText }]}>Checking your local workspace.</Text>
        </Card>
      ) : !setupComplete ? (
        <Card>
          <SectionHeader title="Finish setup" />
          <View style={styles.setupRows}>
            <SetupRow label="Business profile" ready={Boolean(status.activeBusiness)} />
            <SetupRow label="Store or stall" ready={status.stallCount > 0} />
            <SetupRow label="Products" ready={status.productCount > 0} value={`${status.productCount} saved`} />
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Quick actions" />
        <View style={styles.actionGrid}>
          <SecondaryButton href="/owner/inventory" label="Add Product" />
          <PrimaryButton href="/kiosk" label="Open Kiosk" />
          <SecondaryButton href="/owner/records" label="Records" />
          <SecondaryButton href="/owner/settings" label="Settings" />
        </View>
      </Card>

      <Card>
        <SectionHeader action={<SecondaryButton href="/kiosk/orders" label="See all" />} title="Recent Transaction" />
        {recentOrders.length === 0 ? (
          <EmptyState description={`Sales from ${activeBranch} will appear here after checkout.`} title="Wala pang benta today. Start selling in Kiosk." />
        ) : (
          <View style={styles.recentList}>
            {recentOrders.map((order) => (
              <ListRow
                amount={formatPeso(order.amount)}
                badge={order.paymentMethod === "cash" ? "Paid" : order.paymentMethod}
                badgeTone="success"
                icon="B"
                key={order.id}
                subtitle={`${order.transactionNo} · ${order.itemCount} item(s)`}
                title="Kiosk sale"
              />
            ))}
          </View>
        )}
      </Card>
    </ScreenScroll>
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
      <View style={styles.setupLabelWrap}>
        <IconBadge label={ready ? "OK" : "!"} tone={ready ? "success" : "warning"} size="sm" />
        <Text style={[styles.setupLabel, { color: palette.text }]}>{label}</Text>
      </View>
      <Text style={[styles.setupValue, { color: ready ? palette.success : palette.warning }]}>
        {value ?? (ready ? "Ready" : "Needed")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.body,
  },
  businessPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  businessPillText: {
    ...typography.button,
    maxWidth: 250,
  },
  businessPillCaret: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroLabel: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  heroValue: {
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
  },
  heroSubcopy: {
    ...typography.button,
  },
  heroBadge: {
    alignItems: "center",
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  heroBadgeText: {
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 31,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
  setupLabelWrap: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  setupLabel: {
    ...typography.body,
  },
  setupValue: {
    ...typography.button,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  recentList: {
    gap: spacing.sm,
  },
  body: {
    ...typography.body,
  },
});
