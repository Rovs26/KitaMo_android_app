import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, type DimensionValue, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, MetricCard, Pill, ScreenScroll } from "@/components/ui/KitaMoUI";
import { loadGroceryPoolSnapshot, type GroceryPoolSnapshot } from "@/services/groceryPool";
import { getLocalAnalyticsSnapshot, type LocalAnalyticsSnapshot, type PaymentBreakdownItem } from "@/services/localAnalytics";
import { getTodayProductionSummary, type TodayProductionSummary } from "@/services/production";
import { loadRecipesOverview, type RecipesOverview } from "@/services/recipes";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

function formatQuantity(value: number) {
  return value.toLocaleString("en-PH", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

export default function OwnerInsightsScreen() {
  const [snapshot, setSnapshot] = useState<LocalAnalyticsSnapshot | null>(null);
  const [grocery, setGrocery] = useState<GroceryPoolSnapshot | null>(null);
  const [recipesOverview, setRecipesOverview] = useState<RecipesOverview | null>(null);
  const [production, setProduction] = useState<TodayProductionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextSnapshot = await getLocalAnalyticsSnapshot("all");
      const nextGrocery = await loadGroceryPoolSnapshot();
      const nextRecipes = await loadRecipesOverview();
      const nextProduction = await getTodayProductionSummary();
      setSnapshot(nextSnapshot);
      setGrocery(nextGrocery);
      setRecipesOverview(nextRecipes);
      setProduction(nextProduction);
      setError(null);
    } catch (loadError) {
      logDevError("OwnerInsights.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load local insights."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const hasSales = (snapshot?.recentSales.length ?? 0) > 0;
  const maxPaymentTotal = useMemo(
    () => Math.max(...(snapshot?.paymentBreakdown.map((item) => item.total) ?? [0]), 1),
    [snapshot?.paymentBreakdown],
  );

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Simple local summaries from this phone." title="Insights" />

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}

      {loading ? (
        <Card>
          <EmptyState description="Reading local sales and stock." title="Loading insights" />
        </Card>
      ) : null}

      {!loading && !hasSales ? (
        <Card>
          <EmptyState description="Insights will appear after your first sale." title="No sales insights yet" />
        </Card>
      ) : null}

      {snapshot && hasSales ? (
        <>
          <View style={styles.metricGrid}>
            <MetricCard detail="Today" icon="K" label="Today's Kita" tone="primary" value={formatPeso(snapshot.today.salesTotal)} />
            <MetricCard detail="Today" icon="T" label="Transactions" tone="success" value={String(snapshot.today.transactionCount)} />
            <MetricCard detail="Puhunan ng nabenta today" icon="C" label="COGS" tone="danger" value={formatPeso(snapshot.today.costTotal)} />
            <MetricCard
              detail="Benta minus puhunan today"
              icon="G"
              label="Gross profit"
              tone="success"
              value={formatPeso(Math.max(0, snapshot.today.salesTotal - snapshot.today.costTotal))}
            />
            <MetricCard detail="Today" icon="A" label="Average sale" tone="neutral" value={formatPeso(snapshot.today.averageSale)} />
            <MetricCard detail="Pending saves" icon="P" label="Pending" tone="accent" value={String(snapshot.pendingQueueCount)} />
          </View>

          {snapshot.lifecycle.estimatedCogsCountToday > 0 ? (
            <Card>
              <Text style={[styles.itemTitle, { color: palette.text }]}>Estimated cost used</Text>
              <Text style={[styles.body, { color: palette.mutedText }]}>
                Inventory was low sa {snapshot.lifecycle.estimatedCogsCountToday} benta today, kaya recent price ang ginamit ni
                KitaMo. I-check ang Grocery Pool kapag may time.
              </Text>
            </Card>
          ) : null}

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Payment breakdown</Text>
            {snapshot.paymentBreakdown.length === 0 ? (
              <EmptyState description="Payment mix will show after today's sales." title="No payment data today" />
            ) : (
              <View style={styles.breakdownList}>
                {snapshot.paymentBreakdown.map((item) => (
                  <PaymentBreakdownRow item={item} key={item.method} maxTotal={maxPaymentTotal} />
                ))}
              </View>
            )}
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Top products</Text>
            <TopProductCard label="By quantity sold" product={snapshot.topProductByQuantity} />
            <TopProductCard label="By sales amount" product={snapshot.topProductBySales} />
          </Card>
        </>
      ) : null}

      {snapshot && !loading ? (
        <>
          <View style={styles.metricGrid}>
            <MetricCard detail="Active items" icon="I" label="Products" tone="success" value={String(snapshot.lowStock.productCount)} />
            <MetricCard detail="Need review" icon="L" label="Low stock" tone={snapshot.lowStock.lowStockCount > 0 ? "warning" : "success"} value={String(snapshot.lowStock.lowStockCount)} />
            <MetricCard detail="Owner alerts" icon="A" label="Alerts" tone={snapshot.activeAlertCount > 0 ? "warning" : "success"} value={String(snapshot.activeAlertCount)} />
            <MetricCard
              detail={`${grocery?.lowStockIngredients.length ?? 0} low-stock ingredient${(grocery?.lowStockIngredients.length ?? 0) === 1 ? "" : "s"}`}
              icon="G"
              label="Grocery"
              tone={(grocery?.lowStockIngredients.length ?? 0) > 0 ? "warning" : "primary"}
              value={formatPeso(grocery?.totalRemainingValue ?? 0)}
            />
            <MetricCard
              detail={`${recipesOverview?.lowMakeableCount ?? 0} low makeable`}
              icon="R"
              label="Recipes"
              tone={(recipesOverview?.lowMakeableCount ?? 0) > 0 ? "warning" : "success"}
              value={String(recipesOverview?.activeCount ?? 0)}
            />
            <MetricCard
              detail={`${production?.totalOutput ?? 0} item${(production?.totalOutput ?? 0) === 1 ? "" : "s"} produced today`}
              icon="N"
              label="Production"
              tone="primary"
              value={formatPeso(production?.totalCost ?? 0)}
            />
            <MetricCard
              detail="Halaga ng hindi pa nabebenta"
              icon="U"
              label="Unsold goods"
              tone="neutral"
              value={formatPeso(snapshot?.lifecycle.unsoldFinishedValue ?? 0)}
            />
            <MetricCard
              detail={`${snapshot?.lifecycle.transferCountToday ?? 0} transfer${(snapshot?.lifecycle.transferCountToday ?? 0) === 1 ? "" : "s"} today`}
              icon="S"
              label="Sayang today"
              tone={(snapshot?.lifecycle.spoilageLossToday ?? 0) > 0 ? "warning" : "success"}
              value={formatPeso(snapshot?.lifecycle.spoilageLossToday ?? 0)}
            />
          </View>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Stock watch</Text>
            {snapshot.lowStock.lowStockCount === 0 ? (
              <Text style={[styles.body, { color: palette.mutedText }]}>No low-stock products based on current thresholds.</Text>
            ) : (
              snapshot.lowStock.products.slice(0, 5).map((product) => (
                <View key={product.id} style={[styles.stockRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
                  <View style={styles.stockText}>
                    <Text style={[styles.itemTitle, { color: palette.text }]}>{product.name}</Text>
                    <Text style={[styles.body, { color: palette.mutedText }]}>
                      Stock {formatQuantity(product.stockQty)} {product.unitType} · reorder {formatQuantity(product.lowStockThreshold)}
                    </Text>
                  </View>
                  <Pill label={product.stockQty <= 0 ? "Out" : "Low"} tone={product.stockQty <= 0 ? "danger" : "warning"} />
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </ScreenScroll>
  );
}

function PaymentBreakdownRow({ item, maxTotal }: { item: PaymentBreakdownItem; maxTotal: number }) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const widthPercent = `${Math.max(8, Math.round((item.total / maxTotal) * 100))}%` as DimensionValue;

  return (
    <View style={styles.paymentRow}>
      <View style={styles.paymentTop}>
        <Text style={[styles.itemTitle, { color: palette.text }]}>{item.label}</Text>
        <Text style={[styles.itemTitle, { color: palette.primary }]}>{formatPeso(item.total)}</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: palette.background }]}>
        <View style={[styles.barFill, { backgroundColor: palette.primary, width: widthPercent }]} />
      </View>
      <Text style={[styles.helper, { color: palette.mutedText }]}>
        {item.count} transaction{item.count === 1 ? "" : "s"}
      </Text>
    </View>
  );
}

function TopProductCard({
  label,
  product,
}: {
  label: string;
  product: LocalAnalyticsSnapshot["topProductByQuantity"];
}) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={[styles.topProductCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.helper, { color: palette.mutedText }]}>{label}</Text>
      {product ? (
        <>
          <Text style={[styles.itemTitle, { color: palette.text }]}>{product.name}</Text>
          <Text style={[styles.body, { color: palette.mutedText }]}>
            {formatQuantity(product.quantitySold)} sold · {formatPeso(product.salesAmount)}
          </Text>
        </>
      ) : (
        <Text style={[styles.body, { color: palette.mutedText }]}>More sales needed.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.body,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
  },
  body: {
    ...typography.body,
  },
  helper: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  itemTitle: {
    ...typography.button,
  },
  breakdownList: {
    gap: spacing.md,
  },
  paymentRow: {
    gap: spacing.xs,
  },
  paymentTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barTrack: {
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  barFill: {
    borderRadius: 999,
    height: 8,
  },
  topProductCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: 12,
  },
  stockRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: 12,
  },
  stockText: {
    flex: 1,
    gap: spacing.xs,
  },
});
