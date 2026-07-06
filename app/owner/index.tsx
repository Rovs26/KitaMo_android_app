import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { listActiveOwnerAlerts, resolveOwnerAlert } from "@/db/repositories";
import type { OwnerAlert, OwnerAlertSeverity } from "@/domain/types";
import { loadFixedCostsOverview } from "@/services/fixedCosts";
import { listRecentKioskOrders, type KioskOrderSummary } from "@/services/kioskSales";
import { getTodaySalesSummary, type TodaySalesSummary } from "@/services/localAnalytics";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

const severityLabels: Record<OwnerAlertSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

const severityTones: Record<OwnerAlertSeverity, "neutral" | "warning" | "danger"> = {
  info: "neutral",
  warning: "warning",
  critical: "danger",
};

function formatAlertTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OwnerHomeScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [today, setToday] = useState<TodaySalesSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<KioskOrderSummary[]>([]);
  const [alerts, setAlerts] = useState<OwnerAlert[]>([]);
  const [fixedCostAttention, setFixedCostAttention] = useState<{ overdue: number; dueSoon: number }>({ overdue: 0, dueSoon: 0 });
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolveLock = useRef(false);
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
          const nextToday = await getTodaySalesSummary(nextStatus.activeBusiness?.id ?? null);
          const orders = await listRecentKioskOrders(2);
          const nextAlerts = nextStatus.activeBusiness ? await listActiveOwnerAlerts(nextStatus.activeBusiness.id) : [];
          const fixedOverview = await loadFixedCostsOverview();
          if (!active) {
            return;
          }

          setStatus(nextStatus);
          setToday(nextToday);
          setRecentOrders(orders);
          setAlerts(nextAlerts);
          setFixedCostAttention({ overdue: fixedOverview.overdueCount, dueSoon: fixedOverview.dueSoonCount });
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

  async function resolveAlert(alert: OwnerAlert) {
    if (resolveLock.current) {
      return;
    }

    resolveLock.current = true;
    setResolvingAlertId(alert.id);
    try {
      await resolveOwnerAlert(alert.id);
      const businessId = status?.activeBusiness?.id;
      setAlerts(businessId ? await listActiveOwnerAlerts(businessId) : []);
    } catch (resolveError) {
      logDevError("OwnerHome.resolveAlert", resolveError);
      setError(getFriendlyErrorMessage("Could not resolve the alert."));
    } finally {
      resolveLock.current = false;
      setResolvingAlertId(null);
    }
  }

  const setupComplete = Boolean(status?.activeBusiness && status.activeBranch && status.productCount > 0);
  const activeBusiness = status?.activeBusiness?.businessName ?? "Set up your business";
  const activeBranch = status?.activeBranch?.branchName ?? "No active stall yet";
  const salesTotal = today?.salesTotal ?? 0;
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
        <MetricCard detail={`${today?.transactionCount ?? 0} transactions today`} icon="B" label="Benta" tone="primary" value={formatPeso(salesTotal)} />
        <MetricCard detail="No expenses recorded yet" icon="G" label="Gastos" tone="danger" value={formatPeso(0)} />
        <MetricCard detail="Benta minus puhunan today" icon="T" label="Tubo" tone="success" value={formatPeso(Math.max(0, salesTotal - (today?.costTotal ?? 0)))} />
        <MetricCard detail="Pending saves" icon="P" label="Pending" tone="accent" value={String(pendingCount)} />
      </View>

      {!status ? (
        <Card>
          <SectionHeader title={error ? "Please try again" : "Loading"} />
          <Text style={[styles.body, { color: palette.mutedText }]}>
            {error ? "Hindi ma-load ang workspace. Balikan ang Home para subukan ulit." : "Checking your local workspace."}
          </Text>
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

      {fixedCostAttention.overdue > 0 || fixedCostAttention.dueSoon > 0 ? (
        <Card>
          <SectionHeader
            action={<SecondaryButton href="/owner/fixed-costs" label="Open" />}
            title="Bayarin"
          />
          <Text style={[styles.body, { color: fixedCostAttention.overdue > 0 ? palette.danger : palette.mutedText }]}>
            {fixedCostAttention.overdue > 0 ? `${fixedCostAttention.overdue} overdue na fixed cost. ` : ""}
            {fixedCostAttention.dueSoon > 0 ? `${fixedCostAttention.dueSoon} due sa susunod na 7 days.` : ""}
          </Text>
        </Card>
      ) : null}

      <Card>
        <SectionHeader
          action={<Pill label={alerts.length > 0 ? `${alerts.length} active` : "All clear"} tone={alerts.length > 0 ? "warning" : "success"} />}
          title="Alerts"
        />
        {alerts.length === 0 ? (
          <Text style={[styles.body, { color: palette.mutedText }]}>Walang active alerts. Good job!</Text>
        ) : (
          <View style={styles.alertList}>
            {alerts.slice(0, 4).map((alert) => (
              <View key={alert.id} style={[styles.alertRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <View style={styles.alertHeader}>
                  <Text style={[styles.alertTitle, { color: palette.text }]}>{alert.title}</Text>
                  <Pill label={severityLabels[alert.severity]} tone={severityTones[alert.severity]} />
                </View>
                <Text style={[styles.body, { color: palette.mutedText }]}>{alert.message}</Text>
                <View style={styles.alertFooter}>
                  <Text style={[styles.alertTime, { color: palette.mutedText }]}>{formatAlertTime(alert.createdAt)}</Text>
                  <Pressable
                    disabled={resolvingAlertId !== null}
                    onPress={() => resolveAlert(alert)}
                    style={[styles.resolveButton, { borderColor: palette.border, opacity: resolvingAlertId !== null ? 0.55 : 1 }]}
                  >
                    <Text style={[styles.resolveButtonText, { color: palette.primary }]}>
                      {resolvingAlertId === alert.id ? "Resolving..." : "Resolve"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {alerts.length > 4 ? (
              <Text style={[styles.body, { color: palette.mutedText }]}>
                {alerts.length - 4} more alert{alerts.length - 4 === 1 ? "" : "s"} to review.
              </Text>
            ) : null}
          </View>
        )}
      </Card>

      <Card>
        <SectionHeader title="Quick actions" />
        <View style={styles.actionGrid}>
          <SecondaryButton href="/owner/inventory" label="Add Product" />
          <PrimaryButton href="/kiosk" label="Open Kiosk" />
          <SecondaryButton href="/owner/grocery" label="Grocery Pool" />
          <SecondaryButton href="/owner/recipes" label="Recipes" />
          <SecondaryButton href="/owner/production" label="Production" />
          <SecondaryButton href="/owner/reports" label="Reports" />
          <SecondaryButton href="/owner/fixed-costs" label="Fixed Costs" />
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
  alertList: {
    gap: spacing.sm,
  },
  alertRow: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: 12,
  },
  alertHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  alertTitle: {
    ...typography.button,
    flex: 1,
  },
  alertFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  alertTime: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  resolveButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  resolveButtonText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
});
