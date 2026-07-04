import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, formatPeso, MetricCard, ScreenScroll } from "@/components/ui/KitaMoUI";
import { getKioskShiftSummary, loadKioskContext, type KioskContext, type KioskShiftSummary } from "@/services/kioskSales";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

function formatMoney(value: number) {
  return formatPeso(value);
}

export default function KioskShiftScreen() {
  const [summary, setSummary] = useState<KioskShiftSummary | null>(null);
  const [context, setContext] = useState<KioskContext | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextContext = await loadKioskContext();
    const nextSummary = await getKioskShiftSummary();
    setContext(nextContext);
    setSummary(nextSummary);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh().catch((error) => {
        logDevError("KioskShift.refresh", error);
        if (active) {
          setMessage(getFriendlyErrorMessage("Could not load shift summary."));
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  return (
    <ScreenScroll>
      <AppTopBar subtitle="Lahat ng benta na naka-save sa phone na ito." title="Shift Summary" />

      {message ? <Text style={[styles.body, { color: palette.danger }]}>{message}</Text> : null}

      {context?.setupMessage ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Setup needed</Text>
          <Text style={[styles.body, { color: palette.warning }]}>{context.setupMessage}</Text>
        </View>
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard detail={`${summary?.salesCount ?? 0} sales`} icon="B" label="Total Sales" tone="primary" value={summary ? formatMoney(summary.grossSales) : "..."} />
        <MetricCard detail="Cash payments" icon="C" label="Cash" tone="success" value={summary ? formatMoney(summary.cashTotal) : "..."} />
        <MetricCard detail="GCash and Maya" icon="G" label="E-wallet" tone="accent" value={summary ? formatMoney((summary.gcashTotal + summary.mayaTotal)) : "..."} />
        <MetricCard detail="Pending saves" icon="P" label="Pending" tone="warning" value={summary ? String(summary.pendingQueueCount) : "..."} />
      </View>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Totals</Text>
        <SummaryRow label="Sales count" value={summary ? String(summary.salesCount) : "Loading"} />
        <SummaryRow label="Gross sales" value={summary ? formatMoney(summary.grossSales) : "Loading"} />
        <SummaryRow label="Cash" value={summary ? formatMoney(summary.cashTotal) : "Loading"} />
        <SummaryRow label="GCash" value={summary ? formatMoney(summary.gcashTotal) : "Loading"} />
        <SummaryRow label="Maya" value={summary ? formatMoney(summary.mayaTotal) : "Loading"} />
        <SummaryRow label="Bank transfer" value={summary ? formatMoney(summary.bankTransferTotal) : "Loading"} />
        <SummaryRow label="Other" value={summary ? formatMoney(summary.otherTotal) : "Loading"} />
        <SummaryRow label="Pending" value={summary ? String(summary.pendingQueueCount) : "Loading"} />
      </Card>
    </ScreenScroll>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: palette.mutedText }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
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
    elevation: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  summaryLabel: {
    ...typography.body,
    flex: 1,
  },
  summaryValue: {
    ...typography.button,
    flex: 1,
    textAlign: "right",
  },
});
