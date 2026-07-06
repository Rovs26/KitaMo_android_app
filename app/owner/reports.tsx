import { useFocusEffect, useLocalSearchParams } from "expo-router";
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
  const { stallId } = useLocalSearchParams<{ stallId?: string }>();
  const highlightedStallId = typeof stallId === "string" ? stallId : undefined;
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
      setError(getFriendlyErrorMessage("Could not load the kita report."));
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
  const highlightedStall = report?.stalls.find((stall) => stall.branchId === highlightedStallId);

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Benta, puhunan, bayarin, at tubo — per stall at buong negosyo." title="Kita Report" />

      {error ? <Text style={[styles.body, { color: palette.danger }]}>{error}</Text> : null}

      {highlightedStall ? (
        <View style={[styles.focusBanner, { backgroundColor: palette.softPrimary, borderColor: palette.primary }]}>
          <Text style={[styles.focusBannerText, { color: palette.primary }]}>
            Tinitingnan: {highlightedStall.branchName}
          </Text>
        </View>
      ) : null}

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
          <Text style={[styles.body, { color: palette.warning }]}>Create your business profile in Settings first.</Text>
        </Card>
      ) : null}

      {!loading && report?.hasBusiness && !hasActivity ? (
        <Card>
          <EmptyState description="Mag-fill up ang report pag may benta at bayarin na." title="Wala pang laman ang report na ito." />
        </Card>
      ) : null}

      {!loading && consolidated && hasActivity ? (
        <>
          <Card>
            <View style={styles.cardHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Buong negosyo</Text>
              {consolidated.bestStallName ? <Pill label={`Malakas: ${consolidated.bestStallName}`} tone="accent" /> : null}
            </View>

            <ReportRow label="Benta" value={formatPeso(consolidated.revenue)} />
            <ReportRow label="Puhunan / Cost" value={`- ${formatPeso(consolidated.soldCogs)}`} />
            <ReportRow label="Bayarin" value={`- ${formatPeso(consolidated.fixedCosts)}`} />
            <ReportRow label="Nasayang" value={`- ${formatPeso(consolidated.spoilageLoss)}`} />
            <ReportRow
              strong
              label="Tubo"
              value={formatPeso(consolidated.netProfit)}
              valueColor={consolidated.netProfit >= 0 ? palette.success : palette.danger}
            />

            <View style={[styles.formulaBlock, { borderColor: palette.border, backgroundColor: palette.background }]}>
              <Text style={[styles.formulaText, { color: palette.text }]}>
                Tubo = Benta − Puhunan − Bayarin − Nasayang
              </Text>
            </View>

            <View style={[styles.infoBlock, { borderColor: palette.border }]}>
              <Text style={[styles.advancedLabel, { color: palette.mutedText }]}>Advanced details</Text>
              <ReportRow compact label="Sold COGS" value={formatPeso(consolidated.soldCogs)} />
              <ReportRow compact label="Natirang paninda" value={formatPeso(consolidated.unsoldGoodsValue)} />
              <ReportRow compact label="Grocery value" value={formatPeso(consolidated.groceryRemainingValue)} />
              {consolidated.transferCount > 0 ? (
                <ReportRow
                  compact
                  label="Lipat"
                  value={`${consolidated.transferCount} (${formatPeso(consolidated.transferValue)})`}
                />
              ) : null}
              {consolidated.estimatedCogsCount > 0 ? (
                <ReportRow compact label="Estimated cost" value={`${consolidated.estimatedCogsCount} benta`} />
              ) : null}
              {consolidated.businessWideFixedCosts > 0 ? (
                <Text style={[styles.helper, { color: palette.mutedText }]}>
                  Kasama sa bayarin ang {formatPeso(consolidated.businessWideFixedCosts)} para sa buong negosyo.
                </Text>
              ) : null}
            </View>
          </Card>

          {report.stalls.map((stall) => {
            const isHighlighted = stall.branchId === highlightedStallId;
            return (
              <Card
                key={stall.branchId}
                style={
                  isHighlighted
                    ? {
                        borderColor: palette.primary,
                        borderWidth: 2,
                      }
                    : undefined
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>{stall.branchName}</Text>
                  <Text style={[styles.helper, { color: palette.mutedText }]}>
                    {stall.transactionCount} benta
                  </Text>
                </View>

                <ReportRow label="Benta" value={formatPeso(stall.revenue)} />
                <ReportRow label="Puhunan / Cost" value={`- ${formatPeso(stall.soldCogs)}`} />
                <ReportRow label="Bayarin" value={`- ${formatPeso(stall.fixedCosts)}`} />
                <ReportRow label="Nasayang" value={`- ${formatPeso(stall.spoilageLoss)}`} />
                <ReportRow
                  strong
                  label="Tubo"
                  value={formatPeso(stall.netProfit)}
                  valueColor={stall.netProfit >= 0 ? palette.success : palette.danger}
                />

                <View style={[styles.infoBlock, { borderColor: palette.border }]}>
                  <Text style={[styles.advancedLabel, { color: palette.mutedText }]}>Advanced details</Text>
                  <ReportRow compact label="Sold COGS" value={formatPeso(stall.soldCogs)} />
                  <ReportRow compact label="Natirang paninda" value={formatPeso(stall.unsoldGoodsValue)} />
                  {stall.productionCogs > 0 ? (
                    <ReportRow compact label="Niluto spend" value={formatPeso(stall.productionCogs)} />
                  ) : null}
                  {stall.transferInValue > 0 || stall.transferOutValue > 0 ? (
                    <ReportRow
                      compact
                      label="Lipat"
                      value={`in ${formatPeso(stall.transferInValue)} / out ${formatPeso(stall.transferOutValue)}`}
                    />
                  ) : null}
                  {stall.estimatedCogsCount > 0 ? (
                    <Pill label={`${stall.estimatedCogsCount} estimated cost`} tone="warning" />
                  ) : null}
                </View>

                {stall.bestSellerName ? (
                  <Text style={[styles.helper, { color: palette.mutedText }]}>
                    Best paninda: {stall.bestSellerName} ({formatQuantity(stall.bestSellerQuantity)} sold)
                  </Text>
                ) : null}
              </Card>
            );
          })}

          {report.topProducts.length > 0 ? (
            <Card>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Top paninda</Text>
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
                  May benta na estimated ang cost — {consolidated.estimatedCogsCount} benta. Low stock kaya recent price ang ginamit.
                </Text>
              ) : null}
              {consolidated.lowStockIngredientCount > 0 ? (
                <Text style={[styles.body, { color: palette.mutedText }]}>
                  Low stock ang ilang grocery — {consolidated.lowStockIngredientCount} ingredient
                  {consolidated.lowStockIngredientCount === 1 ? "" : "s"}. Check Grocery Stock.
                </Text>
              ) : null}
              {overdueCount > 0 ? (
                <Text style={[styles.body, { color: palette.mutedText }]}>
                  May bayarin na due — {overdueCount} overdue. Check Bayarin.
                </Text>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}

      <SecondaryButton href="/owner/fixed-costs" label="Open Bayarin" />
    </ScreenScroll>
  );
}

type ReportRowProps = {
  label: string;
  value: string;
  strong?: boolean;
  compact?: boolean;
  valueColor?: string;
};

function ReportRow({ label, value, strong = false, compact = false, valueColor }: ReportRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={[styles.reportRow, compact ? styles.reportRowCompact : null]}>
      <Text
        style={[
          strong ? styles.reportLabelStrong : compact ? styles.reportLabelCompact : styles.reportLabel,
          { color: strong ? palette.text : palette.mutedText },
        ]}
      >
        {label}
      </Text>
      <Text style={[strong ? styles.reportValueStrong : compact ? styles.reportValueCompact : styles.reportValue, { color: valueColor ?? palette.text }]}>
        {value}
      </Text>
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
  focusBanner: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  focusBannerText: {
    ...typography.button,
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
  reportRowCompact: {
    marginTop: 2,
  },
  reportLabel: {
    ...typography.body,
    flex: 1,
  },
  reportLabelCompact: {
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
    lineHeight: 16,
  },
  reportLabelStrong: {
    ...typography.button,
    flex: 1,
  },
  reportValue: {
    ...typography.body,
  },
  reportValueCompact: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  reportValueStrong: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  formulaBlock: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: 10,
  },
  formulaText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  infoBlock: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: 10,
  },
  advancedLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  topProductRow: {
    gap: 2,
  },
});
