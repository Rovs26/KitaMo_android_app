import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import { AppTopBar, Card, EmptyState, formatPeso, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { listActiveOwnerAlerts } from "@/db/repositories";
import { isLowStock } from "@/domain/inventory";
import type { Product } from "@/domain/types";
import { loadKioskContext, type KioskContext } from "@/services/kioskSales";
import { notifyOwnerLowStock } from "@/services/stockOps";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, getUserSafeErrorMessage, logDevError } from "@/utils/errors";

export default function KioskStockScreen() {
  const [context, setContext] = useState<KioskContext | null>(null);
  const [alertedProductIds, setAlertedProductIds] = useState<Set<string>>(new Set());
  const [notifyingProductId, setNotifyingProductId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const notifyLock = useRef(false);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextContext = await loadKioskContext();
    setContext(nextContext);

    if (nextContext.activeBusiness) {
      const activeAlerts = await listActiveOwnerAlerts(nextContext.activeBusiness.id);
      setAlertedProductIds(new Set(activeAlerts.map((alert) => alert.productId).filter((id): id is string => Boolean(id))));
    } else {
      setAlertedProductIds(new Set());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh().catch((error) => {
        logDevError("KioskStock.refresh", error);
        if (active) {
          setMessage(getFriendlyErrorMessage("Could not load stock."));
          setMessageIsError(true);
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  async function notifyOwner(product: Product) {
    if (notifyLock.current) {
      return;
    }

    notifyLock.current = true;
    setNotifyingProductId(product.id);
    setMessage(null);
    try {
      const result = await notifyOwnerLowStock(product.id);
      setMessage(
        result.alreadyNotified
          ? `Owner is already notified about ${product.name}.`
          : `Nai-notify na ang owner tungkol sa ${product.name}.`,
      );
      setMessageIsError(false);
      await refresh();
    } catch (error) {
      logDevError("KioskStock.notifyOwner", error);
      setMessage(getUserSafeErrorMessage(error, "Could not notify the owner."));
      setMessageIsError(true);
    } finally {
      notifyLock.current = false;
      setNotifyingProductId(null);
    }
  }

  return (
    <ScreenScroll>
      <AppTopBar
        subtitle={context?.activeBusiness ? `${context.activeBusiness.businessName} · quick stock view` : "Quick stock view for the selling counter."}
        title={context?.activeBranch?.branchName ?? "Stock check"}
      />

      <NetworkStatusBadge pendingQueueCount={context?.pendingQueueCount ?? 0} compact />

      {message ? <Text style={[styles.body, { color: messageIsError ? palette.danger : palette.success }]}>{message}</Text> : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Products</Text>
        {context?.setupMessage ? <Text style={[styles.body, { color: palette.warning }]}>{context.setupMessage}</Text> : null}
        {context && context.products.length === 0 ? (
          <>
            <EmptyState description="Add products in Owner Inventory first." title="No products to sell" />
            <SecondaryButton href="/owner/inventory" label="Add products in Owner Inventory" />
          </>
        ) : null}

        {context?.products.map((product) => (
          <StockRow
            key={product.id}
            notifying={notifyingProductId === product.id}
            notifyDisabled={notifyingProductId !== null}
            onNotify={() => notifyOwner(product)}
            ownerNotified={alertedProductIds.has(product.id)}
            product={product}
          />
        ))}
      </Card>
    </ScreenScroll>
  );
}

type StockRowProps = {
  product: Product;
  ownerNotified: boolean;
  notifying: boolean;
  notifyDisabled: boolean;
  onNotify: () => void;
};

function StockRow({ product, ownerNotified, notifying, notifyDisabled, onNotify }: StockRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const outOfStock = product.stockQty <= 0;
  const lowStock = !outOfStock && isLowStock(product.stockQty, product.lowStockThreshold);
  const needsAttention = outOfStock || lowStock;

  return (
    <View style={[styles.stockRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.stockTopRow}>
        <View style={styles.stockText}>
          <Text style={[styles.itemTitle, { color: palette.text }]}>{product.name}</Text>
          <Text style={[styles.body, { color: palette.mutedText }]}>
            {product.stockQty} {product.unitType} | Threshold {product.lowStockThreshold}
          </Text>
        </View>
        <View style={styles.badges}>
          <Pill label={outOfStock ? "Out of stock" : lowStock ? "Low stock" : "Good"} tone={outOfStock ? "danger" : lowStock ? "warning" : "success"} />
          <Text style={[styles.price, { color: palette.text }]}>{formatPeso(product.price)}</Text>
        </View>
      </View>

      {needsAttention ? (
        <View style={styles.notifyRow}>
          {ownerNotified ? (
            <Pill label="Owner notified" tone="accent" />
          ) : (
            <Pressable
              disabled={notifyDisabled}
              onPress={onNotify}
              style={[styles.notifyButton, { borderColor: palette.border, backgroundColor: palette.surface, opacity: notifyDisabled ? 0.55 : 1 }]}
            >
              <Text style={[styles.notifyButtonText, { color: palette.primary }]}>{notifying ? "Notifying..." : "Notify Owner"}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
  },
  sectionTitle: {
    ...typography.heading,
  },
  stockRow: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  stockTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  stockText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    ...typography.button,
  },
  badges: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  price: {
    ...typography.button,
  },
  notifyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  notifyButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  notifyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
});
