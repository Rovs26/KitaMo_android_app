import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>Kiosk Stock</Text>
        <Text style={[styles.title, { color: palette.text }]}>{context?.activeBranch?.branchName ?? "Stock check"}</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>Quick stock view for the selling counter.</Text>
      </View>

      {message ? <Text style={[styles.body, { color: palette.danger }]}>{message}</Text> : null}

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Products</Text>
        {context?.setupMessage ? <Text style={[styles.body, { color: palette.warning }]}>{context.setupMessage}</Text> : null}
        {context && context.products.length === 0 ? (
          <Link href="/owner/inventory" asChild>
            <Pressable style={[styles.secondaryAction, { borderColor: palette.border }]}>
              <Text style={[styles.secondaryActionText, { color: palette.primary }]}>Add products in Owner Inventory</Text>
            </Pressable>
          </Link>
        ) : null}

        {context?.products.map((product) => (
          <StockRow key={product.id} product={product} />
        ))}
      </View>
    </ScrollView>
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
        {outOfStock ? <Text style={[styles.badge, { backgroundColor: palette.danger, color: palette.kioskHeaderText }]}>Out of stock</Text> : null}
        {lowStock ? <Text style={[styles.badge, { backgroundColor: palette.warning, color: palette.kioskHeaderText }]}>Low stock</Text> : null}
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
