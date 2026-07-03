import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import { AppTopBar, Card, EmptyState, HeroCard, IconBadge, PrimaryButton, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { loadKioskContext, type KioskContext } from "@/services/kioskSales";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

export default function KioskHomeScreen() {
  const [context, setContext] = useState<KioskContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setCurrentMode = useAppStore((state) => state.setCurrentMode);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function refresh() {
        try {
          const nextContext = await loadKioskContext();
          if (active) {
            setContext(nextContext);
            setCurrentMode("kiosk");
            setError(null);
          }
        } catch (loadError) {
          logDevError("KioskHome.refresh", loadError);
          if (active) {
            setError(getFriendlyErrorMessage("Could not load Kiosk."));
          }
        }
      }

      refresh();

      return () => {
        active = false;
      };
    }, [setCurrentMode]),
  );

  return (
    <ScreenScroll>
      <AppTopBar subtitle="Fast local selling" title="Kiosk Mode" />

      {error ? <Text style={[styles.body, { color: palette.danger }]}>{error}</Text> : null}

      <HeroCard>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={[styles.heroLabel, { color: palette.kioskHeaderText }]}>Active stall</Text>
            <Text style={[styles.heroTitle, { color: palette.kioskHeaderText }]}>
              {context?.activeBranch?.branchName ?? "No stall selected"}
            </Text>
            <Text style={[styles.heroMeta, { color: palette.softAccent }]}>
              {context?.activeBusiness?.businessName ?? "Set up Owner profile first"}
            </Text>
          </View>
          <IconBadge label="K" tone="accent" size="lg" />
        </View>
        <NetworkStatusBadge compact pendingQueueCount={context?.pendingQueueCount ?? 0} />
      </HeroCard>

      {context?.setupMessage ? (
        <Card>
          <EmptyState description={context.setupMessage} title="Setup needed" />
          {!context.activeBusiness || !context.activeBranch ? (
            <SecondaryButton href="/owner/settings" label="Open Owner Settings" />
          ) : (
            <SecondaryButton href="/owner/inventory" label="Add products in Owner Inventory" />
          )}
        </Card>
      ) : (
        <Card>
          <View style={styles.readyRow}>
            <IconBadge label="B" tone="success" />
            <View style={styles.readyText}>
              <Text style={[styles.readyTitle, { color: palette.text }]}>Ready to sell</Text>
              <Text style={[styles.body, { color: palette.mutedText }]}>{context?.products.length ?? 0} products available</Text>
            </View>
          </View>
          <PrimaryButton href="/kiosk/sell" label="Start selling" />
        </Card>
      )}

      <View style={styles.actionGrid}>
        <SecondaryButton href="/kiosk/orders" label="Orders" />
        <SecondaryButton href="/kiosk/stock" label="Stock" />
        <SecondaryButton href="/kiosk/shift" label="Shift Summary" />
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  heroLabel: {
    ...typography.button,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  heroMeta: {
    ...typography.body,
  },
  readyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  readyText: {
    flex: 1,
    gap: spacing.xs,
  },
  readyTitle: {
    ...typography.heading,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
