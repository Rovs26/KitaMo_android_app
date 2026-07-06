import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, MetricCard, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import type { ProductionBatchWithNames } from "@/db/repositories";
import {
  getLocalAnalyticsSnapshot,
  type LocalAnalyticsSnapshot,
  type LocalSaleRecord,
  type SalesRecordFilter,
} from "@/services/localAnalytics";
import { listRecentProduction } from "@/services/production";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

const filters: { id: SalesRecordFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "all", label: "All" },
  { id: "cash", label: "Cash" },
  { id: "digital", label: "GCash/Maya/Bank" },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function paymentLabel(method: string) {
  if (method === "bank transfer") {
    return "Bank";
  }

  return method;
}

function movementBadge(movementType: string, linkedSaleId: string | null): { label: string; tone: "primary" | "success" | "danger" | "neutral" } {
  if (movementType === "cooked") {
    return { label: "Niluto", tone: "primary" };
  }

  if (movementType === "spoilage") {
    return { label: "Nasayang", tone: "danger" };
  }

  if (linkedSaleId) {
    return { label: "Sale", tone: "success" };
  }

  if (movementType === "stock_in") {
    return { label: "Stock in", tone: "success" };
  }

  return { label: "Stock", tone: "neutral" };
}

export default function OwnerRecordsScreen() {
  const [snapshot, setSnapshot] = useState<LocalAnalyticsSnapshot | null>(null);
  const [productionBatches, setProductionBatches] = useState<ProductionBatchWithNames[]>([]);
  const [activeFilter, setActiveFilter] = useState<SalesRecordFilter>("today");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async (filter: SalesRecordFilter) => {
    setLoading(true);
    try {
      const nextSnapshot = await getLocalAnalyticsSnapshot(filter);
      const nextProduction = await listRecentProduction(5);
      setSnapshot(nextSnapshot);
      setProductionBatches(nextProduction);
      setError(null);
    } catch (loadError) {
      logDevError("OwnerRecords.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load local records."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh(activeFilter);
    }, [activeFilter, refresh]),
  );

  function changeFilter(filter: SalesRecordFilter) {
    setActiveFilter(filter);
    setSelectedSaleId(null);
  }

  const selectedSale = snapshot?.recentSales.find((sale) => sale.id === selectedSaleId) ?? null;

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Lahat ng local sales, resibo, at stock movement." title="Records" />

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}

      <View style={styles.summaryGrid}>
        <MetricCard detail="Today" icon="T" label="Transactions" tone="primary" value={String(snapshot?.recordsSummary.transactionCount ?? 0)} />
        <MetricCard detail="Today" icon="B" label="Sales" tone="success" value={formatPeso(snapshot?.recordsSummary.salesTotal ?? 0)} />
        <MetricCard detail="Saved locally" icon="R" label="Receipts" tone="neutral" value={String(snapshot?.recordsSummary.totalReceipts ?? 0)} />
        <MetricCard detail="Pending saves" icon="P" label="Pending" tone="accent" value={String(snapshot?.recordsSummary.pendingQueueCount ?? 0)} />
      </View>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Sales records</Text>
        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => changeFilter(filter.id)}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: active ? palette.primary : palette.surface,
                    borderColor: active ? palette.primary : palette.border,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: active ? palette.kioskHeaderText : palette.text }]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? <EmptyState description="Reading local sales." title="Loading records" /> : null}

        {!loading && snapshot?.recentSales.length === 0 ? (
          <>
            <EmptyState description="Wala pang records. Start selling in Kiosk." title="No local records yet" />
            <SecondaryButton href="/kiosk/sell" label="Open Kiosk Sell" />
          </>
        ) : null}

        {snapshot?.recentSales.map((sale) => (
          <SaleCard
            key={sale.id}
            onPress={() => setSelectedSaleId((current) => (current === sale.id ? null : sale.id))}
            sale={sale}
            selected={selectedSaleId === sale.id}
          />
        ))}
      </Card>

      {selectedSale ? (
        <Card>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptTitle}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Receipt detail</Text>
              <Text style={[styles.body, { color: palette.mutedText }]}>{selectedSale.transactionNo}</Text>
            </View>
            <Pill label="Local" tone="success" />
          </View>
          {selectedSale.receiptText ? (
            <Text style={[styles.receiptText, { color: palette.text }]}>{selectedSale.receiptText}</Text>
          ) : (
            <EmptyState description="Receipt text is not available for this sale." title="No receipt text" />
          )}
        </Card>
      ) : null}

      {productionBatches.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Niluto / Production</Text>
          {productionBatches.map((batch) => (
            <View key={batch.id} style={[styles.movementRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.movementText}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>
                  {batch.recipeName}
                  {batch.outputProductName ? ` → ${batch.outputProductName}` : ""}
                </Text>
                <Text style={[styles.body, { color: palette.mutedText }]}>
                  {batch.outputQuantity} {batch.outputUnit}
                  {batch.branchName ? ` · ${batch.branchName}` : ""} · {formatPeso(batch.totalBatchCost)}
                </Text>
                <Text style={[styles.helper, { color: palette.mutedText }]}>{formatDateTime(batch.createdAt)}</Text>
              </View>
              <Pill label="Niluto" tone="primary" />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent stock movements</Text>
        {snapshot?.recentMovements.length === 0 ? (
          <EmptyState description="Stock movement records will appear after Kiosk sales or inventory changes." title="No movement records yet" />
        ) : null}
        {snapshot?.recentMovements.slice(0, 8).map((movement) => {
          const badge = movementBadge(movement.movementType, movement.linkedSaleId);
          return (
            <View key={movement.id} style={[styles.movementRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.movementText}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>{movement.productName}</Text>
                <Text style={[styles.body, { color: palette.mutedText }]}>
                  {movement.movementType.replaceAll("_", " ")} · {movement.quantity} {movement.unitType ?? ""}
                </Text>
                <Text style={[styles.helper, { color: palette.mutedText }]}>{formatDateTime(movement.createdAt)}</Text>
              </View>
              <Pill label={badge.label} tone={badge.tone} />
            </View>
          );
        })}
      </Card>
    </ScreenScroll>
  );
}

function SaleCard({ sale, selected, onPress }: { sale: LocalSaleRecord; selected: boolean; onPress: () => void }) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.saleCard,
        {
          backgroundColor: selected ? palette.softPrimary : palette.background,
          borderColor: selected ? palette.primary : palette.border,
        },
      ]}
    >
      <View style={styles.saleTopRow}>
        <View style={styles.saleText}>
          <Text style={[styles.itemTitle, { color: palette.text }]}>{sale.transactionNo}</Text>
          <Text style={[styles.body, { color: palette.mutedText }]}>{formatDateTime(sale.happenedAt)}</Text>
        </View>
        <Text style={[styles.saleAmount, { color: palette.primary }]}>{formatPeso(sale.amount)}</Text>
      </View>
      <View style={styles.saleMetaRow}>
        <Pill label={paymentLabel(sale.paymentMethod)} tone={sale.paymentMethod === "cash" ? "success" : "accent"} />
        <Text style={[styles.helper, { color: palette.mutedText }]}>
          {sale.itemCount} item{sale.itemCount === 1 ? "" : "s"}
        </Text>
        {sale.externalReferenceNumber ? (
          <Text style={[styles.helper, { color: palette.mutedText }]}>Ref {sale.externalReferenceNumber}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.body,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  saleCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 12,
  },
  saleTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  saleText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    ...typography.button,
  },
  body: {
    ...typography.body,
  },
  helper: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  saleAmount: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23,
  },
  saleMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  receiptHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  receiptTitle: {
    flex: 1,
    gap: spacing.xs,
  },
  receiptText: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 18,
  },
  movementRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: 12,
  },
  movementText: {
    flex: 1,
    gap: spacing.xs,
  },
});
