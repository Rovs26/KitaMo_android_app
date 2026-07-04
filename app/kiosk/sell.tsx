import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import { AppTopBar, Card, EmptyState, formatPeso, Pill, PrimaryButton, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { isLowStock } from "@/domain/inventory";
import { bundleLabelFor, calculateCartSubtotal, calculateLineTotal, hasBundlePricing } from "@/domain/pricing";
import type { Product } from "@/domain/types";
import { loadKioskContext, type KioskContext } from "@/services/kioskSales";
import { useKioskStore } from "@/state/kioskStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

function formatMoney(value: number) {
  return formatPeso(value);
}

export default function KioskSellScreen() {
  const [context, setContext] = useState<KioskContext | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cartItems = useKioskStore((state) => state.cartItems);
  const addProductToCart = useKioskStore((state) => state.addProductToCart);
  const incrementCartItem = useKioskStore((state) => state.incrementCartItem);
  const decrementCartItem = useKioskStore((state) => state.decrementCartItem);
  const removeCartItem = useKioskStore((state) => state.removeCartItem);
  const clearCart = useKioskStore((state) => state.clearCart);
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
        logDevError("KioskSell.refresh", error);
        if (active) {
          setMessage(getFriendlyErrorMessage("Could not load products."));
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  function addToCart(product: Product) {
    const result = addProductToCart(product);
    setMessage(result.ok ? `${product.name} added to cart.` : (result.reason ?? "Could not add product."));
  }

  function increase(productId: string) {
    const result = incrementCartItem(productId);
    if (!result.ok) {
      setMessage(result.reason ?? "Could not increase quantity.");
    }
  }

  const total = calculateCartSubtotal(cartItems);

  return (
    <ScreenScroll>
      <AppTopBar subtitle="Tap a product to add it to the cart." title={context?.activeBranch?.branchName ?? "Sell"} />

      {context?.setupMessage ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Setup needed</Text>
          <Text style={[styles.body, { color: palette.warning }]}>{context.setupMessage}</Text>
          {context.setupMessage === "Add products in Owner Inventory first." ? (
            <SecondaryButton href="/owner/inventory" label="Open Owner Inventory" />
          ) : null}
        </Card>
      ) : null}

      {message ? <Text style={[styles.message, { color: message.includes("Could not") ? palette.danger : palette.text }]}>{message}</Text> : null}

      <NetworkStatusBadge compact pendingQueueCount={context?.pendingQueueCount ?? 0} />

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Products</Text>
        {context && context.products.length === 0 ? (
          <EmptyState description="Add products in Owner Inventory first." title="No paninda yet" />
        ) : null}

        {context?.products.map((product) => (
          <ProductRow key={product.id} product={product} onAdd={() => addToCart(product)} />
        ))}
      </Card>

      <Card>
        <View style={styles.cartHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Cart</Text>
          {cartItems.length > 0 ? (
            <Pressable onPress={clearCart}>
              <Text style={[styles.clearText, { color: palette.danger }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {cartItems.length === 0 ? <EmptyState description="Tap a product above to start a sale." title="Cart is empty" /> : null}

        {cartItems.map((item) => {
          const pricing = calculateLineTotal(item);
          return (
            <View key={item.productId} style={[styles.cartItem, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.cartItemHeader}>
                <View style={styles.cartText}>
                  <Text style={[styles.itemTitle, { color: palette.text }]}>{item.name}</Text>
                  <Text style={[styles.body, { color: palette.mutedText }]}>
                    {formatMoney(item.unitPrice)} x {item.quantity} = {formatMoney(pricing.lineTotal)}
                  </Text>
                  {pricing.bundleApplied && pricing.displayLabel ? (
                    <Text style={[styles.bundleApplied, { color: palette.warning }]}>Bundle applied: {pricing.displayLabel}</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => removeCartItem(item.productId)}>
                  <Text style={[styles.clearText, { color: palette.danger }]}>Remove</Text>
                </Pressable>
              </View>
              <View style={styles.quantityRow}>
                <Pressable style={[styles.quantityButton, { borderColor: palette.border }]} onPress={() => decrementCartItem(item.productId)}>
                  <Text style={[styles.quantityText, { color: palette.text }]}>-</Text>
                </Pressable>
                <Text style={[styles.quantityValue, { color: palette.text }]}>{item.quantity}</Text>
                <Pressable style={[styles.quantityButton, { borderColor: palette.border }]} onPress={() => increase(item.productId)}>
                  <Text style={[styles.quantityText, { color: palette.text }]}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: palette.text }]}>Total</Text>
          <Text style={[styles.totalValue, { color: palette.text }]}>{formatMoney(total)}</Text>
        </View>

        {cartItems.length > 0 ? (
          <PrimaryButton href="/kiosk/checkout" label="Checkout" />
        ) : null}
      </Card>
    </ScreenScroll>
  );
}

type ProductRowProps = {
  product: Product;
  onAdd: () => void;
};

function ProductRow({ product, onAdd }: ProductRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const lowStock = isLowStock(product.stockQty, product.lowStockThreshold);
  const outOfStock = product.stockQty <= 0;
  const bundleLabel = hasBundlePricing(product) ? bundleLabelFor(product.bundleQuantity, product.bundlePrice, product.bundleLabel) : null;

  return (
    <Pressable
      disabled={outOfStock}
      onPress={onAdd}
      style={[
        styles.productRow,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: outOfStock ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.productText}>
        <Text style={[styles.itemTitle, { color: palette.text }]}>{product.name}</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          {product.stockQty} {product.unitType} | {formatMoney(product.price)}
        </Text>
        {bundleLabel ? <Text style={[styles.bundleOffer, { color: palette.warning }]}>{bundleLabel}</Text> : null}
      </View>
      <View style={styles.badges}>
        {outOfStock ? <Pill label="Out" tone="danger" /> : null}
        {!outOfStock && lowStock ? <Pill label="Low" tone="warning" /> : null}
        {!outOfStock ? <Text style={[styles.addText, { color: palette.primary }]}>Add</Text> : null}
      </View>
    </Pressable>
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
  bundleOffer: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  bundleApplied: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  message: {
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
  productRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  productText: {
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
  addText: {
    ...typography.button,
  },
  cartHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  cartItem: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 12,
  },
  cartItemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  cartText: {
    flex: 1,
    gap: spacing.xs,
  },
  quantityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  quantityButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 44,
  },
  quantityText: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    minWidth: 36,
    textAlign: "center",
  },
  totalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    ...typography.heading,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
  },
  primaryAction: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryActionText: {
    ...typography.button,
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    ...typography.button,
  },
});
