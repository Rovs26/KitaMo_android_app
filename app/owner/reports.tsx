import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { loadFixedCostsOverview } from "@/services/fixedCosts";
import { loadProfitReport, reportRanges, type ProfitReport, type ReportRange } from "@/services/profitReports";
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

export default function OwnerReportsScreen() {
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [range, setRange] = useState<ReportRange>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async (nextRange: ReportRange) => {
    setLoading(true);
    try {
      const nextReport = await loadProfitReport(nextRange);
      const fixedOverview = await loadFixedCostsOverview();
      setReport(nextReport);
      setOverdueCount(fixedOverview.overdueCount);
      setError(null);
    } catch (loadError) {
      logDevError("OwnerReports.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load the profit report."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh(range);
    }, [range, refresh]),
  );

  const consolidated = report?.consolidated;
  const hasActivity = (consolidated?.transactionCount ?? 0) > 0 || (consolidated?.fixedCosts ?? 0) > 0;

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="See each stall and your whole business." title="Profit Reports" />

      {error ? <Text style={[styles.body, { color: palette.danger }]}>{error}</Text> : null}

      <View style={styles.rangeRow}>
        {reportRanges.map((entry) => {
          const isSelected = entry.id === range;
          return (
            <Pressable
              key={entry.id}
              onPress={() => setRange(entry.id)}
              style={[
                styles.rangeButton,
                {
                  backgroundColor: isSelected ? palette.primary : palette.surface,
                  borderColor: isSelected ? palette.primary : palette.border,
                },
              ]}
            >
              <Text style={[styles.rangeText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Card>
          <EmptyState description="Binabasa ang local records." title="Loading report" />
        </Card>
      ) : null}

      {!loading && report && !report.hasBusiness ? (
        <Card>
          <Text style={[styles.body, { color: palette.warning }]}>Create your business profile in Owner Settings first.</Text>
        </Card>
      ) : null}

      {!loading && report?.hasBusiness && !hasActivity ? (
        <Card>
          <EmptyState description="Reports will fill up after sales and fixed costs are saved." title="Wala pang laman ang report na ito." />
        </Card>
      ) : null}

      {!loading && consolidated && hasActivity ? (
        <>
          <Card>
            <View style={styles.cardHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Buong negosyo</Text>
              {consolidated.bestStallName ? <Pill label={`Best: ${consolidated.bestStallName}`} tone="accent" /> : null}
            </View>

            <ReportRow label="Revenue" value={formatPeso(consolidated.revenue)} />
            <ReportRow label="Sold COGS (puhunan ng nabenta)" value={`- ${formatPeso(consolidated.soldCogs)}`} />
            <ReportRow strong label="Gross profit" value={formatPeso(consolidated.grossProfit)} />
            <ReportRow label="Fixed costs" value={`- ${formatPeso(consolidated.fixedCosts)}`} />
            <ReportRow label="Sayang / spoilage" value={`- ${formatPeso(consolidated.spoilageLoss)}`} />
            <ReportRow
              strong
              label="Net profit"
              value={formatPeso(consolidated.netProfit)}
              valueColor={consolidated.netProfit >= 0 ? palette.success : palette.danger}
            />

            <View style={[styles.infoBlock, { borderColor: palette.border }]}>
              <Text style={[styles.helper, { color: palette.mutedText }]}>
                Hindi kasama sa gastos: unsold goods {formatPeso(consolidated.unsoldGoodsValue)} at grocery na natitira{" "}
                {formatPeso(consolidated.groceryRemainingValue)} — puhunan pa rin ito, hindi pa nagagastos.
              </Text>
              {consolidated.transferCount > 0 ? (
                <Text style={[styles.helper, { color: palette.mutedText }]}>
                  {consolidated.transferCount} transfer{consolidated.transferCount === 1 ? "" : "s"} (
                  {formatPeso(consolidated.transferValue)}) — paglipat lang ng value, hindi benta.
                </Text>
              ) : null}
              {consolidated.businessWideFixedCosts > 0 ? (
                <Text style={[styles.helper, { color: palette.mutedText }]}>
                  Kasama sa fixed costs ang {formatPeso(consolidated.businessWideFixedCosts)} na para sa buong negosyo (wala sa
                  per-stall cards).
                </Text>
              ) : null}
            </View>
          </Card>

          {report.stalls.map((stall) => (
            <Card key={stall.branchId}>
              <View style={styles.cardHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>{stall.branchName}</Text>
                <Text style={[styles.helper, { color: palette.mutedText }]}>
                  {stall.transactionCount} sale{stall.transactionCount === 1 ? "" : "s"}
                </Text>
              </View>

              <ReportRow label="Revenue" value={formatPeso(stall.revenue)} />
              <ReportRow label="Sold COGS" value={`- ${formatPeso(stall.soldCogs)}`} />
              <ReportRow strong label="Gross profit" value={formatPeso(stall.grossProfit)} />
              <ReportRow label="Fixed costs (stall)" value={`- ${formatPeso(stall.fixedCosts)}`} />
              <ReportRow label="Sayang" value={`- ${formatPeso(stall.spoilageLoss)}`} />
              <ReportRow
                strong
                label="Net profit"
                value={formatPeso(stall.netProfit)}
                valueColor={stall.netProfit >= 0 ? palette.success : palette.danger}
              />

              <View style={styles.stallMetaRow}>
                <Text style={[styles.helper, { color: palette.mutedText }]}>Unsold goods: {formatPeso(stall.unsoldGoodsValue)}</Text>
                {stall.productionCogs > 0 ? (
                  <Text style={[styles.helper, { color: palette.mutedText }]}>Niluto: {formatPeso(stall.productionCogs)}</Text>
                ) : null}
                {stall.transferInValue > 0 || stall.transferOutValue > 0 ? (
                  <Text style={[styles.helper, { color: palette.mutedText }]}>
                    Lipat in {formatPeso(stall.transferInValue)} / out {formatPeso(stall.transferOutValue)}
                  </Text>
                ) : null}
              </View>

              {stall.bestSellerName ? (
                <Text style={[styles.helper, { color: palette.mutedText }]}>
                  Best seller: {stall.bestSellerName} ({formatQuantity(stall.bestSellerQuantity)} sold)
                </Text>
              ) : null}
              {stall.estimatedCogsCount > 0 ? (
                <Pill label={`${stall.estimatedCogsCount} estimated cost`} tone="warning" />
              ) : null}
            </Card>
          ))}

          {report.topProducts.length > 0 ? (
            <Card>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Top products</Text>
              {report.topProducts.map((product, index) => (
                <View key={product.name} style={styles.topProductRow}>
                  <Text style={[styles.body, { color: palette.text }]}>
                    {index + 1}. {product.name}
                  </Text>
                  <Text style={[styles.helper, { color: palette.mutedText }]}>
                    {formatQuantity(product.quantity)} sold · {formatPeso(product.salesAmount)}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {consolidated.estimatedCogsCount > 0 || consolidated.lowStockIngredientCount > 0 || overdueCount > 0 ? (
            <Card>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Paalala</Text>
              {consolidated.estimatedCogsCount > 0 ? (
                <Text style={[styles.body, { color: palette.mutedText }]}>
                  Estimated cost used sa {consolidated.estimatedCogsCount} benta — inventory was low, kaya recent price ang
                  ginamit ni KitaMo.
                </Text>
              ) : null}
              {consolidated.lowStockIngredientCount > 0 ? (
                <Text style={[styles.body, { color: palette.mutedText }]}>
                  {consolidated.lowStockIngredientCount} grocery ingredient{consolidated.lowStockIngredientCount === 1 ? "" : "s"} ang
                  low stock. Check the Grocery Pool.
                </Text>
              ) : null}
              {overdueCount > 0 ? (
                <Text style={[styles.body, { color: palette.mutedText }]}>
                  {overdueCount} fixed cost{overdueCount === 1 ? "" : "s"} ang overdue. Check Fixed Costs.
                </Text>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}

      <SecondaryButton href="/owner/fixed-costs" label="Open Fixed Costs" />
    </ScreenScroll>
  );
}

type ReportRowProps = {
  label: string;
  value: string;
  strong?: boolean;
  valueColor?: string;
};

function ReportRow({ label, value, strong = false, valueColor }: ReportRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.reportRow}>
      <Text style={[strong ? styles.reportLabelStrong : styles.reportLabel, { color: strong ? palette.text : palette.mutedText }]}>
        {label}
      </Text>
      <Text style={[strong ? styles.reportValueStrong : styles.reportValue, { color: valueColor ?? palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
  },
  helper: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  sectionTitle: {
    ...typography.heading,
  },
  rangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  rangeButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rangeText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  reportRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  reportLabel: {
    ...typography.body,
    flex: 1,
  },
  reportLabelStrong: {
    ...typography.button,
    flex: 1,
  },
  reportValue: {
    ...typography.body,
  },
  reportValueStrong: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  infoBlock: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: 10,
  },
  stallMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  topProductRow: {
    gap: 2,
  },
});
