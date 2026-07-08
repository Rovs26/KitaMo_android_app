import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import { AppTopBar, Card, EmptyState, formatPeso, HeroCard, Pill, PrimaryButton, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { bundleLabelFor, hasBundlePricing } from "@/domain/pricing";
import { isLowStock } from "@/domain/inventory";
import type { Product } from "@/domain/types";
import { loadKioskContext, type KioskContext } from "@/services/kioskSales";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

const kioskTabs: { label: string; href: "/kiosk/sell" | "/kiosk/orders" | "/kiosk/stock" | "/kiosk/shift"; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Sell", href: "/kiosk/sell", icon: "cart-outline" },
  { label: "Orders", href: "/kiosk/orders", icon: "receipt-outline" },
  { label: "Stock", href: "/kiosk/stock", icon: "cube-outline" },
  { label: "Shift", href: "/kiosk/shift", icon: "time-outline" },
];

export default function KioskHomeScreen() {
  const [context, setContext] = useState<KioskContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setCurrentMode = useAppStore((state) => state.setCurrentMode);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const router = useRouter();

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

  const products = context?.products ?? [];
  const ready = Boolean(context && !context.setupMessage);

  return (
    <ScreenScroll>
      <AppTopBar subtitle="Fast local selling" title="Kiosk" />

      {error ? <Text style={[styles.body, { color: palette.danger }]}>{error}</Text> : null}

      <HeroCard>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={[styles.heroLabel, { color: palette.softAccent }]}>Active stall</Text>
            <Text numberOfLines={1} style={[styles.heroTitle, { color: palette.kioskHeaderText }]}>
              {context?.activeBranch?.branchName ?? "No stall selected"}
            </Text>
            <Text numberOfLines={1} style={[styles.heroMeta, { color: palette.softAccent }]}>
              {context?.activeBusiness?.businessName ?? "Set up Owner profile first"}
            </Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: palette.softAccent }]}>
            <Ionicons color={palette.primary} name="storefront" size={26} />
          </View>
        </View>
        <NetworkStatusBadge compact pendingQueueCount={context?.pendingQueueCount ?? 0} />
      </HeroCard>

      <View style={styles.tabRow}>
        {kioskTabs.map((tab) => (
          <Pressable
            key={tab.label}
            onPress={() => router.push(tab.href)}
            style={[styles.tabChip, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Ionicons color={palette.primary} name={tab.icon} size={18} />
            <Text style={[styles.tabLabel, { color: palette.text }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {context?.setupMessage ? (
        <Card>
          <EmptyState description={context.setupMessage} title="Setup needed" />
          {!context.activeBusiness || !context.activeBranch ? (
            <SecondaryButton href="/owner/settings" label="Open Settings" />
          ) : (
            <SecondaryButton href="/owner/inventory" label="Add products in Inventory" />
          )}
        </Card>
      ) : (
        <Card>
          <View style={styles.sellHeader}>
            <View style={styles.sellHeaderText}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Mga paninda</Text>
              <Text style={[styles.helper, { color: palette.mutedText }]}>{products.length} available · tap para mag-benta</Text>
            </View>
            <Pill label="Ready" tone="success" />
          </View>

          {products.slice(0, 6).map((product) => (
            <KioskProductRow key={product.id} onPress={() => router.push("/kiosk/sell")} product={product} />
          ))}

          {products.length > 6 ? (
            <Text style={[styles.helper, { color: palette.mutedText }]}>+{products.length - 6} pang paninda sa Sell</Text>
          ) : null}
        </Card>
      )}

      {ready ? <PrimaryButton href="/kiosk/sell" label="Buksan ang benta" /> : null}
    </ScreenScroll>
  );
}

function KioskProductRow({ product, onPress }: { product: Product; onPress: () => void }) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const outOfStock = product.stockQty <= 0;
  const lowStock = !outOfStock && isLowStock(product.stockQty, product.lowStockThreshold);
  const bundleLabel = hasBundlePricing(product) ? bundleLabelFor(product.bundleQuantity, product.bundlePrice, product.bundleLabel) : null;

  return (
    <Pressable onPress={onPress} style={[styles.productRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.productText}>
        <Text numberOfLines={1} style={[styles.productName, { color: palette.text }]}>
          {product.name}
        </Text>
        <Text style={[styles.helper, { color: palette.mutedText }]}>
          {product.stockQty} {product.unitType}
          {bundleLabel ? ` · ${bundleLabel}` : ""}
        </Text>
      </View>
      <View style={styles.productTrailing}>
        <Text style={[styles.productPrice, { color: palette.primary }]}>{formatPeso(product.price)}</Text>
        {outOfStock ? <Pill label="Out" tone="danger" /> : lowStock ? <Pill label="Low" tone="warning" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
  },
  helper: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27,
  },
  heroMeta: {
    ...typography.body,
  },
  heroBadge: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tabChip: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    paddingVertical: spacing.sm,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  sellHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  sellHeaderText: {
    flex: 1,
    gap: 2,
  },
  productRow: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
  },
  productText: {
    flex: 1,
    gap: 2,
  },
  productName: {
    ...typography.button,
  },
  productTrailing: {
    alignItems: "flex-end",
    gap: 3,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
});
