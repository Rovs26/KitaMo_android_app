import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { isLowStock } from "@/domain/inventory";
import type { Product } from "@/domain/types";
import { loadKioskContext, type KioskContext } from "@/services/kioskSales";
import { useKioskStore } from "@/state/kioskStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

function formatMoney(value: number) {
  return `PHP ${value.toFixed(2)}`;
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
        if (active) {
          setMessage(error instanceof Error ? error.message : "Could not load products.");
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

  const total = cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>Kiosk Sell</Text>
        <Text style={[styles.title, { color: palette.text }]}>{context?.activeBranch?.branchName ?? "Selling counter"}</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          Tap products to add them to the cart. Stock is checked again during checkout.
        </Text>
      </View>

      {context?.setupMessage ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Setup needed</Text>
          <Text style={[styles.body, { color: palette.warning }]}>{context.setupMessage}</Text>
          {context.setupMessage === "Add products in Owner Inventory first." ? (
            <Link href="/owner/inventory" asChild>
              <Pressable style={[styles.secondaryAction, { borderColor: palette.border }]}>
                <Text style={[styles.secondaryActionText, { color: palette.primary }]}>Open Owner Inventory</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      ) : null}

      {message ? <Text style={[styles.message, { color: message.includes("Could not") ? palette.danger : palette.text }]}>{message}</Text> : null}

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Products</Text>
        {context && context.products.length === 0 ? (
          <Text style={[styles.body, { color: palette.mutedText }]}>Add products in Owner Inventory first.</Text>
        ) : null}

        {context?.products.map((product) => (
          <ProductRow key={product.id} product={product} onAdd={() => addToCart(product)} />
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.cartHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Cart</Text>
          {cartItems.length > 0 ? (
            <Pressable onPress={clearCart}>
              <Text style={[styles.clearText, { color: palette.danger }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {cartItems.length === 0 ? <Text style={[styles.body, { color: palette.mutedText }]}>Cart is empty.</Text> : null}

        {cartItems.map((item) => (
          <View key={item.productId} style={[styles.cartItem, { borderColor: palette.border }]}>
            <View style={styles.cartItemHeader}>
              <View style={styles.cartText}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>{item.name}</Text>
                <Text style={[styles.body, { color: palette.mutedText }]}>
                  {formatMoney(item.unitPrice)} x {item.quantity} = {formatMoney(item.unitPrice * item.quantity)}
                </Text>
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
        ))}

        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: palette.text }]}>Total</Text>
          <Text style={[styles.totalValue, { color: palette.text }]}>{formatMoney(total)}</Text>
        </View>

        {cartItems.length > 0 ? (
          <Link href="/kiosk/checkout" asChild>
            <Pressable style={[styles.primaryAction, { backgroundColor: palette.primary }]}>
              <Text style={[styles.primaryActionText, { color: palette.kioskHeaderText }]}>Checkout</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
    </ScrollView>
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

  return (
    <Pressable
      disabled={outOfStock}
      onPress={onAdd}
      style={[
        styles.productRow,
        {
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
      </View>
      <View style={styles.badges}>
        {outOfStock ? <Text style={[styles.badge, { backgroundColor: palette.danger, color: palette.kioskHeaderText }]}>Out</Text> : null}
        {!outOfStock && lowStock ? (
          <Text style={[styles.badge, { backgroundColor: palette.warning, color: palette.kioskHeaderText }]}>Low</Text>
        ) : null}
        {!outOfStock ? <Text style={[styles.addText, { color: palette.primary }]}>Add</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.sm,
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
  message: {
    ...typography.body,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
  },
  productRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.md,
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
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
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
    height: 40,
    justifyContent: "center",
    width: 48,
  },
  quantityText: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
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
    ...typography.heading,
  },
  primaryAction: {
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryActionText: {
    ...typography.button,
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    ...typography.button,
  },
});
