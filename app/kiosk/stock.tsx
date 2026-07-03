import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { isLowStock } from "@/domain/inventory";
import type { Product } from "@/domain/types";
import { loadKioskContext, type KioskContext } from "@/services/kioskSales";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

export default function KioskStockScreen() {
  const [context, setContext] = useState<KioskContext | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextContext = await loadKioskContext();
    setContext(nextContext);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh().catch((error) => {
        logDevError("KioskStock.refresh", error);
        if (active) {
          setMessage(getFriendlyErrorMessage("Could not load stock."));
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  return (
    <ScreenScroll>
      <AppTopBar subtitle="Quick stock view for the selling counter." title={context?.activeBranch?.branchName ?? "Stock check"} />

      {message ? <Text style={[styles.body, { color: palette.danger }]}>{message}</Text> : null}

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
          <StockRow key={product.id} product={product} />
        ))}
      </Card>
    </ScreenScroll>
  );
}

type StockRowProps = {
  product: Product;
};

function StockRow({ product }: StockRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const outOfStock = product.stockQty <= 0;
  const lowStock = !outOfStock && isLowStock(product.stockQty, product.lowStockThreshold);

  return (
    <View style={[styles.stockRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
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
  sectionTitle: {
    ...typography.heading,
  },
  stockRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
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
  badge: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    ...typography.button,
  },
});
