import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, type Href } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
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
  ScreenScroll,
  SectionHeader,
  SecondaryButton,
} from "@/components/ui/KitaMoUI";
import { listActiveOwnerAlerts, resolveOwnerAlert } from "@/db/repositories";
import type { OwnerAlert, OwnerAlertSeverity } from "@/domain/types";
import { loadFixedCostsOverview } from "@/services/fixedCosts";
import { loadGroceryPoolSnapshot, type GroceryPoolSnapshot } from "@/services/groceryPool";
import { listRecentKioskOrders, type KioskOrderSummary } from "@/services/kioskSales";
import { getLocalAnalyticsSnapshot, getTodaySalesSummary, type TodaySalesSummary } from "@/services/localAnalytics";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { loadProfitReport, type ProfitReport, type StallReport } from "@/services/profitReports";
import { loadRecipesOverview, type RecipesOverview } from "@/services/recipes";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

type AttentionItem = {
  message: string;
  href: Href;
  tone: "danger" | "warning";
};

type StallStatus = "good" | "attention" | "loss" | "none";

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

const quickAddShortcuts: { label: string; href: Href; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Start Selling", href: "/kiosk", icon: "storefront-outline" },
  { label: "Add Grocery", href: "/owner/grocery", icon: "basket-outline" },
  { label: "Add Product", href: "/owner/inventory", icon: "cube-outline" },
  { label: "Add Recipe", href: "/owner/recipes", icon: "restaurant-outline" },
  { label: "Add Niluto", href: "/owner/production", icon: "flame-outline" },
  { label: "Add Bayarin", href: "/owner/fixed-costs", icon: "receipt-outline" },
  { label: "Kita Report", href: "/owner/reports", icon: "bar-chart-outline" },
];

const quickToolGroups: { title: string; tools: { label: string; href: Href }[] }[] = [
  {
    title: "Selling",
    tools: [
      { label: "Paninda", href: "/owner/inventory" },
      { label: "Settings", href: "/owner/settings" },
    ],
  },
  {
    title: "Costing",
    tools: [
      { label: "Grocery Stock", href: "/owner/grocery" },
      { label: "Recipe Cost", href: "/owner/recipes" },
      { label: "Niluto", href: "/owner/production" },
      { label: "Lipat", href: "/owner/transfers" },
    ],
  },
  {
    title: "Money",
    tools: [{ label: "Bayarin", href: "/owner/fixed-costs" }],
  },
  {
    title: "Reports",
    tools: [
      { label: "Kita Report", href: "/owner/reports" },
      { label: "Logbook", href: "/owner/records" },
    ],
  },
];

function formatAlertTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStallStatus(stall: StallReport): StallStatus {
  if (stall.transactionCount === 0) {
    return "none";
  }

  if (stall.netProfit < 0) {
    return "loss";
  }

  if (stall.estimatedCogsCount > 0) {
    return "attention";
  }

  return "good";
}

function stallStatusLabel(status: StallStatus) {
  if (status === "good") {
    return "Good today";
  }

  if (status === "attention") {
    return "Needs attention";
  }

  if (status === "loss") {
    return "Loss today";
  }

  return "No sales yet";
}

function stallStatusTone(status: StallStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "good") {
    return "success";
  }

  if (status === "attention") {
    return "warning";
  }

  if (status === "loss") {
    return "danger";
  }

  return "neutral";
}

function buildAttentionItems(input: {
  overdueCount: number;
  dueSoonCount: number;
  groceryLowStockCount: number;
  productLowStockCount: number;
  estimatedCogsCount: number;
  lowMakeableCount: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.overdueCount > 0 || input.dueSoonCount > 0) {
    items.push({
      message:
        input.overdueCount > 0
          ? `May bayarin na due — ${input.overdueCount} overdue${input.dueSoonCount > 0 ? `, ${input.dueSoonCount} malapit na` : ""}.`
          : `May bayarin na due — ${input.dueSoonCount} sa susunod na 7 araw.`,
      href: "/owner/fixed-costs",
      tone: input.overdueCount > 0 ? "danger" : "warning",
    });
  }

  if (input.groceryLowStockCount > 0) {
    items.push({
      message: `Low stock ang ilang grocery — ${input.groceryLowStockCount} ingredient${input.groceryLowStockCount === 1 ? "" : "s"}.`,
      href: "/owner/grocery",
      tone: "warning",
    });
  }

  if (input.productLowStockCount > 0) {
    items.push({
      message: `Low stock ang ilang paninda — ${input.productLowStockCount} product${input.productLowStockCount === 1 ? "" : "s"}.`,
      href: "/owner/inventory",
      tone: "warning",
    });
  }

  if (input.estimatedCogsCount > 0) {
    items.push({
      message: `May benta na estimated ang cost — ${input.estimatedCogsCount} sale${input.estimatedCogsCount === 1 ? "" : "s"} today.`,
      href: "/owner/reports",
      tone: "warning",
    });
  }

  if (input.lowMakeableCount > 0) {
    items.push({
      message: `Konti na lang ang kayang lutuin — ${input.lowMakeableCount} recipe${input.lowMakeableCount === 1 ? "" : "s"}.`,
      href: "/owner/recipes",
      tone: "warning",
    });
  }

  return items;
}

export default function OwnerHomeScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [today, setToday] = useState<TodaySalesSummary | null>(null);
  const [todayReport, setTodayReport] = useState<ProfitReport | null>(null);
  const [grocery, setGrocery] = useState<GroceryPoolSnapshot | null>(null);
  const [recipesOverview, setRecipesOverview] = useState<RecipesOverview | null>(null);
  const [recentOrders, setRecentOrders] = useState<KioskOrderSummary[]>([]);
  const [alerts, setAlerts] = useState<OwnerAlert[]>([]);
  const [productLowStockCount, setProductLowStockCount] = useState(0);
  const [estimatedCogsCount, setEstimatedCogsCount] = useState(0);
  const [unsoldGoodsValue, setUnsoldGoodsValue] = useState(0);
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
          const businessId = nextStatus.activeBusiness?.id ?? null;
          // Sequential on purpose: concurrent reads on the shared SQLite handle
          // have caused native prepared-statement errors on SDK 54.
          const nextToday = await getTodaySalesSummary(businessId);
          const nextReport = await loadProfitReport("today");
          const nextGrocery = await loadGroceryPoolSnapshot();
          const nextRecipes = await loadRecipesOverview();
          const orders = await listRecentKioskOrders(2);
          const nextAnalytics = await getLocalAnalyticsSnapshot("today");
          const fixedOverview = await loadFixedCostsOverview();
          const nextAlerts = businessId ? await listActiveOwnerAlerts(businessId) : [];

          if (!active) {
            return;
          }

          setStatus(nextStatus);
          setToday(nextToday);
          setTodayReport(nextReport);
          setGrocery(nextGrocery);
          setRecipesOverview(nextRecipes);
          setRecentOrders(orders);
          setAlerts(nextAlerts);
          setProductLowStockCount(nextAnalytics.lowStock.lowStockCount);
          setEstimatedCogsCount(nextAnalytics.lifecycle.estimatedCogsCountToday);
          setUnsoldGoodsValue(nextAnalytics.lifecycle.unsoldFinishedValue);
          setFixedCostAttention({ overdue: fixedOverview.overdueCount, dueSoon: fixedOverview.dueSoonCount });
          setActiveBusinessId(businessId);
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
  const costTotal = today?.costTotal ?? 0;
  const bayarinToday = todayReport?.consolidated.fixedCosts ?? 0;
  const nasayangToday = todayReport?.consolidated.spoilageLoss ?? 0;
  const tuboToday = todayReport?.consolidated.netProfit ?? Math.max(0, salesTotal - costTotal);
  const pendingCount = status?.pendingQueueCount ?? 0;
  const stallReports = todayReport?.stalls ?? [];

  const attentionItems = useMemo(
    () =>
      buildAttentionItems({
        overdueCount: fixedCostAttention.overdue,
        dueSoonCount: fixedCostAttention.dueSoon,
        groceryLowStockCount: grocery?.lowStockIngredients.length ?? 0,
        productLowStockCount,
        estimatedCogsCount,
        lowMakeableCount: recipesOverview?.lowMakeableCount ?? 0,
      }),
    [estimatedCogsCount, fixedCostAttention.dueSoon, fixedCostAttention.overdue, grocery?.lowStockIngredients.length, productLowStockCount, recipesOverview?.lowMakeableCount],
  );

  const nextAction =
    attentionItems[0] ??
    (salesTotal === 0
      ? { message: "Wala pang benta today — simulan ang pagbebenta sa Kiosk.", href: "/kiosk" as Href, tone: "warning" as const }
      : null);

  return (
    <ScreenScroll bottomNav>
      <AppTopBar
        right={
          <View style={styles.topRightRow}>
            <Pill label={status?.mode === "demo" ? "Demo" : "Fresh"} tone={status?.mode === "demo" ? "accent" : "success"} />
            <Link href="/owner/settings" asChild>
              <Pressable hitSlop={8} style={[styles.gearButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Ionicons color={palette.primary} name="settings-outline" size={20} />
              </Pressable>
            </Link>
          </View>
        }
        subtitle="Magandang araw!"
        title="Home"
      />

      {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}

      <View style={[styles.businessPill, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <IconBadge label="S" size="sm" tone="primary" />
        <View style={styles.businessCopy}>
          <Text numberOfLines={1} style={[styles.businessPillText, { color: palette.text }]}>
            {activeBusiness}
          </Text>
          <Text numberOfLines={1} style={[styles.stallPillText, { color: palette.mutedText }]}>
            {activeBranch}
          </Text>
        </View>
      </View>

      <View style={styles.primaryActionRow}>
        <Link href="/kiosk" asChild>
          <Pressable style={[styles.startSellingButton, { backgroundColor: palette.primary }]}>
            <Ionicons color={palette.kioskHeaderText} name="storefront-outline" size={22} />
            <View style={styles.startSellingText}>
              <Text style={[styles.startSellingTitle, { color: palette.kioskHeaderText }]}>Start Selling</Text>
              <Text style={[styles.startSellingSub, { color: palette.softAccent }]}>Buksan ang Kiosk</Text>
            </View>
          </Pressable>
        </Link>
      </View>

      <Card>
        <SectionHeader title="Quick Add" />
        <View style={styles.quickAddGrid}>
          {quickAddShortcuts.map((shortcut) => (
            <Link key={shortcut.label} href={shortcut.href} asChild>
              <Pressable style={[styles.quickAddCell, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Ionicons color={palette.primary} name={shortcut.icon} size={18} />
                <Text style={[styles.quickAddLabel, { color: palette.text }]}>{shortcut.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </Card>

      <HeroCard>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroLabel, { color: palette.kioskHeaderText }]}>{"Today's Money"}</Text>
            <Text style={[styles.heroValue, { color: palette.kioskHeaderText }]}>{formatPeso(salesTotal)}</Text>
            <Text style={[styles.heroSubcopy, { color: palette.softAccent }]}>
              {salesTotal > 0 ? `Tubo today: ${formatPeso(tuboToday)}` : "Wala pang benta today"}
            </Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: palette.softAccent }]}>
            <Text style={[styles.heroBadgeText, { color: palette.primary }]}>₱</Text>
          </View>
        </View>
        <NetworkStatusBadge compact pendingQueueCount={pendingCount} />
      </HeroCard>

      <View style={styles.metricGrid}>
        <MetricCard detail={`${today?.transactionCount ?? 0} benta today`} icon="B" label="Benta" tone="primary" value={formatPeso(salesTotal)} />
        <MetricCard detail="Puhunan ng nabenta today" icon="P" label="Puhunan / Cost" tone="danger" value={formatPeso(costTotal)} />
        <MetricCard detail="Benta − puhunan − bayarin − nasayang" icon="T" label="Tubo" tone="success" value={formatPeso(tuboToday)} />
        <MetricCard
          detail={
            fixedCostAttention.overdue > 0
              ? `${fixedCostAttention.overdue} overdue`
              : fixedCostAttention.dueSoon > 0
                ? `${fixedCostAttention.dueSoon} due soon`
                : bayarinToday > 0
                  ? `${formatPeso(bayarinToday)} today`
                  : "Walang due na bayarin"
          }
          icon="!"
          label="Bayarin"
          tone={fixedCostAttention.overdue > 0 ? "danger" : fixedCostAttention.dueSoon > 0 ? "warning" : "neutral"}
          value={fixedCostAttention.overdue + fixedCostAttention.dueSoon > 0 ? String(fixedCostAttention.overdue + fixedCostAttention.dueSoon) : formatPeso(bayarinToday)}
        />
        <MetricCard
          detail={`${grocery?.lowStockIngredients.length ?? 0} low stock`}
          icon="G"
          label="Grocery value"
          tone="accent"
          value={formatPeso(grocery?.totalRemainingValue ?? 0)}
        />
        <MetricCard detail="Natitirang paninda sa stock" icon="N" label="Natirang paninda" tone="neutral" value={formatPeso(unsoldGoodsValue)} />
      </View>

      {nasayangToday > 0 ? (
        <Text style={[styles.inlineNote, { color: palette.mutedText }]}>Nasayang today: {formatPeso(nasayangToday)}</Text>
      ) : null}

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
            <SetupRow label="Paninda" ready={status.productCount > 0} value={`${status.productCount} saved`} />
          </View>
        </Card>
      ) : null}

      {stallReports.length > 0 ? (
        <Card>
          <SectionHeader action={<SecondaryButton href="/owner/reports" label="Kita Report" />} title="Stall Performance" />
          <View style={styles.stallList}>
            {stallReports.map((stall) => (
              <StallFinanceCard key={stall.branchId} stall={stall} />
            ))}
          </View>
        </Card>
      ) : null}

      {nextAction ? (
        <Card>
          <SectionHeader title="Next action" />
          <Link href={nextAction.href} asChild>
            <Pressable style={[styles.nextActionRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <IconBadge label="→" size="sm" tone={nextAction.tone} />
              <Text style={[styles.nextActionText, { color: nextAction.tone === "danger" ? palette.danger : palette.text }]}>
                {nextAction.message}
              </Text>
            </Pressable>
          </Link>
        </Card>
      ) : null}

      {attentionItems.length > 0 ? (
        <Card>
          <SectionHeader action={<Pill label={`${attentionItems.length} item${attentionItems.length === 1 ? "" : "s"}`} tone="warning" />} title="Needs Attention" />
          <View style={styles.attentionList}>
            {attentionItems.map((item) => (
              <Link key={item.message} href={item.href} asChild>
                <Pressable style={[styles.attentionRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
                  <Pill label={item.tone === "danger" ? "Due" : "Check"} tone={item.tone} />
                  <Text style={[styles.attentionText, { color: palette.text }]}>{item.message}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </Card>
      ) : (
        <Card>
          <SectionHeader action={<Pill label="All clear" tone="success" />} title="Needs Attention" />
          <Text style={[styles.body, { color: palette.mutedText }]}>Walang urgent na kailangan ng action today. Good job!</Text>
        </Card>
      )}

      {alerts.length > 0 ? (
        <Card>
          <SectionHeader action={<Pill label={`${alerts.length} active`} tone="warning" />} title="Stock alerts" />
          <View style={styles.alertList}>
            {alerts.slice(0, 3).map((alert) => (
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
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Quick Tools" />
        {quickToolGroups.map((group) => (
          <View key={group.title} style={styles.toolGroup}>
            <Text style={[styles.toolGroupTitle, { color: palette.mutedText }]}>{group.title}</Text>
            <View style={styles.actionGrid}>
              {group.tools.map((tool) => (
                <View key={tool.label} style={styles.actionCell}>
                  <SecondaryButton href={tool.href} label={tool.label} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader action={<SecondaryButton href="/owner/records" label="Logbook" />} title="Recent benta" />
        {recentOrders.length === 0 ? (
          <EmptyState description={`Sales from ${activeBranch} will appear here after checkout.`} title="Wala pang benta today. Start selling sa Kiosk." />
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
                title="Benta"
              />
            ))}
          </View>
        )}
      </Card>
    </ScreenScroll>
  );
}

function StallFinanceCard({ stall }: { stall: StallReport }) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const stallStatus = getStallStatus(stall);

  return (
    <Link href={`/owner/reports?stallId=${stall.branchId}` as Href} asChild>
      <Pressable style={[styles.stallCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <View style={styles.stallCardHeader}>
          <Text style={[styles.stallName, { color: palette.text }]}>{stall.branchName}</Text>
          <Pill label={stallStatusLabel(stallStatus)} tone={stallStatusTone(stallStatus)} />
        </View>
        <View style={styles.stallMetrics}>
          <View style={styles.stallMetric}>
            <Text style={[styles.stallMetricLabel, { color: palette.mutedText }]}>Benta</Text>
            <Text style={[styles.stallMetricValue, { color: palette.text }]}>{formatPeso(stall.revenue)}</Text>
          </View>
          <View style={styles.stallMetric}>
            <Text style={[styles.stallMetricLabel, { color: palette.mutedText }]}>Puhunan</Text>
            <Text style={[styles.stallMetricValue, { color: palette.text }]}>{formatPeso(stall.soldCogs)}</Text>
          </View>
          <View style={styles.stallMetric}>
            <Text style={[styles.stallMetricLabel, { color: palette.mutedText }]}>Tubo</Text>
            <Text style={[styles.stallMetricValue, { color: stall.netProfit >= 0 ? palette.success : palette.danger }]}>
              {formatPeso(stall.netProfit)}
            </Text>
          </View>
        </View>
        <Text style={[styles.stallMeta, { color: palette.mutedText }]}>
          {stall.transactionCount} benta today
          {stall.bestSellerName ? ` · Best: ${stall.bestSellerName}` : ""}
        </Text>
      </Pressable>
    </Link>
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
        <IconBadge label={ready ? "OK" : "!"} size="sm" tone={ready ? "success" : "warning"} />
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
  businessCopy: {
    flexShrink: 1,
    gap: 1,
  },
  businessPillText: {
    ...typography.button,
  },
  stallPillText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
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
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
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
  inlineNote: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
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
  quickAddGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickAddCell: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "30%",
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 72,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  quickAddLabel: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
    textAlign: "center",
  },
  stallList: {
    gap: spacing.sm,
  },
  stallCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 12,
  },
  stallCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  stallName: {
    ...typography.button,
    flex: 1,
  },
  stallMetrics: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stallMetric: {
    flex: 1,
    gap: 2,
  },
  stallMetricLabel: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },
  stallMetricValue: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  stallMeta: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  nextActionRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: 12,
  },
  nextActionText: {
    ...typography.body,
    flex: 1,
  },
  attentionList: {
    gap: spacing.sm,
  },
  attentionRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: 12,
  },
  attentionText: {
    ...typography.body,
    flex: 1,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionCell: {
    flexBasis: "47%",
    flexGrow: 1,
  },
  toolGroup: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  toolGroupTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  topRightRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  gearButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  primaryActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  startSellingButton: {
    alignItems: "center",
    borderRadius: 8,
    elevation: 2,
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  startSellingText: {
    gap: 1,
  },
  startSellingTitle: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  startSellingSub: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
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
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  resolveButtonText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
});
