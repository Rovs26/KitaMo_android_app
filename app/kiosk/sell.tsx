import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { NetworkStatusBadge } from "@/components/common/NetworkStatusBadge";
import { AppTopBar, Card, EmptyState, formatPeso, Pill, PrimaryButton, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { isLowStock } from "@/domain/inventory";
import { bundleLabelFor, calculateCartSubtotal, calculateLineTotal, hasBundlePricing } from "@/domain/pricing";
import type { Product } from "@/domain/types";
import {
  loadKioskPreferences,
  recordRecentProduct,
  saveFavoriteProductIds,
} from "@/services/kioskPreferences";
import { loadKioskContext, type KioskContext } from "@/services/kioskSales";
import { useKioskStore } from "@/state/kioskStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

function formatMoney(value: number) {
  return formatPeso(value);
}

export default function KioskSellScreen() {
  const [context, setContext] = useState<KioskContext | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
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
    const preferences = await loadKioskPreferences();
    setContext(nextContext);
    setFavoriteProductIds(preferences.favoriteProductIds);
    setRecentProductIds(preferences.recentProductIds);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh().catch((error) => {
        logDevError("KioskSell.refresh", error);
        if (active) {
          setMessage(getFriendlyErrorMessage("Could not load products."));
          setMessageIsError(true);
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  function addToCart(product: Product) {
    const cookedToOrder = Boolean(context?.cookUponOrderRecipeByProductId[product.id]);
    const result = addProductToCart(product, cookedToOrder);
    if (!result.ok) {
      setMessage(result.reason ?? "Could not add product.");
      setMessageIsError(true);
      return;
    }

    setMessage(null);
    void Haptics.selectionAsync();
    const nextRecentIds = [product.id, ...recentProductIds.filter((id) => id !== product.id)].slice(0, 8);
    setRecentProductIds(nextRecentIds);
    recordRecentProduct(product.id, recentProductIds).catch((error) => {
      logDevError("KioskSell.recordRecentProduct", error);
    });
  }

  function increase(productId: string) {
    const result = incrementCartItem(productId);
    if (!result.ok) {
      setMessage(result.reason ?? "Could not increase quantity.");
      setMessageIsError(true);
    } else {
      setMessage(null);
      void Haptics.selectionAsync();
    }
  }

  function decrease(productId: string) {
    decrementCartItem(productId);
    setMessage(null);
    void Haptics.selectionAsync();
  }

  function toggleFavorite(productId: string) {
    const wasFavorite = favoriteProductIds.includes(productId);
    const nextIds = wasFavorite
      ? favoriteProductIds.filter((id) => id !== productId)
      : [productId, ...favoriteProductIds];
    setFavoriteProductIds(nextIds);
    void Haptics.selectionAsync();
    saveFavoriteProductIds(nextIds).catch((error) => {
      logDevError("KioskSell.toggleFavorite", error);
      setFavoriteProductIds(favoriteProductIds);
      setMessage("Could not save favorites. Please try again.");
      setMessageIsError(true);
    });
  }

  function confirmClearCart() {
    Alert.alert("Clear cart?", "All items in this sale will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearCart },
    ]);
  }

  const total = calculateCartSubtotal(cartItems);
  const cartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const categories = useMemo(
    () => [...new Set((context?.products ?? []).map((product) => product.category.trim()).filter(Boolean))].sort(),
    [context?.products],
  );
  const visibleProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    let products = [...(context?.products ?? [])];

    if (selectedFilter === "favorites") {
      products = products.filter((product) => favoriteProductIds.includes(product.id));
    } else if (selectedFilter === "recent") {
      products = products
        .filter((product) => recentProductIds.includes(product.id))
        .sort((left, right) => recentProductIds.indexOf(left.id) - recentProductIds.indexOf(right.id));
    } else if (selectedFilter !== "all") {
      products = products.filter((product) => product.category === selectedFilter);
    }

    if (normalizedQuery) {
      products = products.filter((product) =>
        `${product.name} ${product.category}`.toLocaleLowerCase().includes(normalizedQuery),
      );
    }

    return products;
  }, [context?.products, favoriteProductIds, recentProductIds, searchQuery, selectedFilter]);

  return (
    <ScreenScroll kioskNav>
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

      {message ? <Text style={[styles.message, { color: messageIsError ? palette.danger : palette.text }]}>{message}</Text> : null}

      <NetworkStatusBadge compact pendingQueueCount={context?.pendingQueueCount ?? 0} />

      {cartItems.length > 0 ? (
        <View style={[styles.fastCheckout, { backgroundColor: palette.primary }]}>
          <View style={styles.fastCheckoutCopy}>
            <Text style={[styles.fastCheckoutCount, { color: palette.softAccent }]}>
              {cartQuantity} item{cartQuantity === 1 ? "" : "s"} in cart
            </Text>
            <Text style={[styles.fastCheckoutTotal, { color: palette.kioskHeaderText }]}>{formatMoney(total)}</Text>
          </View>
          <PrimaryButton href="/kiosk/checkout" label="Checkout" />
        </View>
      ) : null}

      <Card>
        <View style={styles.productsHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Products</Text>
          <Text style={[styles.resultCount, { color: palette.mutedText }]}>{visibleProducts.length} shown</Text>
        </View>
        <View style={[styles.searchBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Ionicons color={palette.mutedText} name="search-outline" size={20} />
          <TextInput
            onChangeText={setSearchQuery}
            placeholder="Search paninda"
            placeholderTextColor={palette.mutedText}
            style={[styles.searchInput, { color: palette.text }]}
            value={searchQuery}
          />
          {searchQuery ? (
            <Pressable hitSlop={8} onPress={() => setSearchQuery("")}>
              <Ionicons color={palette.mutedText} name="close-circle" size={20} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal contentContainerStyle={styles.filterRow} showsHorizontalScrollIndicator={false}>
          <FilterChip active={selectedFilter === "all"} label="All" onPress={() => setSelectedFilter("all")} />
          <FilterChip active={selectedFilter === "favorites"} icon="star" label="Favorites" onPress={() => setSelectedFilter("favorites")} />
          <FilterChip active={selectedFilter === "recent"} icon="time" label="Recent" onPress={() => setSelectedFilter("recent")} />
          {categories.map((category) => (
            <FilterChip active={selectedFilter === category} key={category} label={category} onPress={() => setSelectedFilter(category)} />
          ))}
        </ScrollView>
        {context && context.products.length === 0 ? (
          <EmptyState description="Add products in Owner Inventory first." title="No paninda yet" />
        ) : null}

        {context && context.products.length > 0 && visibleProducts.length === 0 ? (
          <EmptyState
            description={selectedFilter === "favorites" ? "Tap the star on a product to keep it here." : "Try another category or search term."}
            title={selectedFilter === "favorites" ? "No favorites yet" : selectedFilter === "recent" ? "No recent products yet" : "No matching products"}
          />
        ) : null}

        <View style={styles.productGrid}>
          {visibleProducts.map((product) => (
            <ProductTile
              cartQuantity={cartItems.find((item) => item.productId === product.id)?.quantity ?? 0}
              cookedToOrder={Boolean(context?.cookUponOrderRecipeByProductId[product.id])}
              favorite={favoriteProductIds.includes(product.id)}
              key={product.id}
              product={product}
              onAdd={() => addToCart(product)}
              onDecrement={() => decrease(product.id)}
              onIncrement={() => increase(product.id)}
              onToggleFavorite={() => toggleFavorite(product.id)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.cartHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Cart</Text>
          {cartItems.length > 0 ? (
            <Pressable onPress={confirmClearCart}>
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

type ProductTileProps = {
  product: Product;
  cookedToOrder: boolean;
  cartQuantity: number;
  favorite: boolean;
  onAdd: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  onToggleFavorite: () => void;
};

function ProductTile({
  product,
  cookedToOrder,
  cartQuantity,
  favorite,
  onAdd,
  onDecrement,
  onIncrement,
  onToggleFavorite,
}: ProductTileProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const lowStock = isLowStock(product.stockQty, product.lowStockThreshold);
  const outOfStock = product.stockQty <= 0 && !cookedToOrder;
  const bundleLabel = hasBundlePricing(product) ? bundleLabelFor(product.bundleQuantity, product.bundlePrice, product.bundleLabel) : null;

  return (
    <View
      style={[
        styles.productTile,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: outOfStock ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.tileTop}>
        <Pressable disabled={outOfStock} onPress={onAdd} style={styles.tileNameWrap}>
          <Text numberOfLines={2} style={[styles.tileName, { color: palette.text }]}>
            {product.name}
          </Text>
          <Text numberOfLines={1} style={[styles.tileCategory, { color: palette.mutedText }]}>{product.category}</Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={onToggleFavorite} style={styles.favoriteButton}>
          <Ionicons color={favorite ? palette.accent : palette.mutedText} name={favorite ? "star" : "star-outline"} size={21} />
        </Pressable>
      </View>
      <Pressable disabled={outOfStock} onPress={onAdd} style={styles.tileBody}>
        <Text style={[styles.tilePrice, { color: palette.primary }]}>{formatMoney(product.price)}</Text>
        <Text numberOfLines={1} style={[styles.tileMeta, { color: palette.mutedText }]}>
          {cookedToOrder ? "Luto kapag may order" : `${product.stockQty} ${product.unitType}`}
        </Text>
        {bundleLabel ? (
          <Text numberOfLines={1} style={[styles.bundleOffer, { color: palette.warning }]}>
            {bundleLabel}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.tileFooter}>
        <View style={styles.tileBadges}>
          {cookedToOrder ? <Pill label="Made to order" tone="accent" /> : null}
          {outOfStock ? <Pill label="Out" tone="danger" /> : null}
          {!outOfStock && !cookedToOrder && lowStock ? <Pill label="Low" tone="warning" /> : null}
        </View>
        {cartQuantity > 0 ? (
          <View style={[styles.tileQuantity, { backgroundColor: palette.softPrimary }]}>
            <Pressable hitSlop={4} onPress={onDecrement} style={styles.tileQuantityButton}>
              <Ionicons color={palette.primary} name="remove" size={19} />
            </Pressable>
            <Text style={[styles.tileQuantityValue, { color: palette.primary }]}>{cartQuantity}</Text>
            <Pressable disabled={outOfStock} hitSlop={4} onPress={onIncrement} style={styles.tileQuantityButton}>
              <Ionicons color={palette.primary} name="add" size={19} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={outOfStock}
            onPress={onAdd}
            style={[styles.tileAddButton, { backgroundColor: palette.primary, opacity: outOfStock ? 0.5 : 1 }]}
          >
            <Ionicons color={palette.kioskHeaderText} name="add" size={20} />
            <Text style={[styles.tileAddText, { color: palette.kioskHeaderText }]}>Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FilterChip({ active, label, onPress, icon }: { active: boolean; label: string; onPress: () => void; icon?: "star" | "time" }) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? palette.primary : palette.background,
          borderColor: active ? palette.primary : palette.border,
        },
      ]}
    >
      {icon ? <Ionicons color={active ? palette.kioskHeaderText : palette.primary} name={icon} size={14} /> : null}
      <Text style={[styles.filterChipText, { color: active ? palette.kioskHeaderText : palette.text }]}>{label}</Text>
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
  fastCheckout: {
    alignItems: "center",
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.sm,
    paddingLeft: spacing.md,
  },
  fastCheckoutCopy: {
    flex: 1,
    gap: 2,
  },
  fastCheckoutCount: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  fastCheckoutTotal: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27,
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
  productsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultCount: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  searchBox: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  filterRow: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  filterChip: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  productTile: {
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 174,
    padding: spacing.sm + 2,
  },
  tileTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
  },
  tileNameWrap: {
    flex: 1,
    gap: 2,
  },
  tileName: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  tileCategory: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  favoriteButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  tileBody: {
    flex: 1,
    gap: 2,
  },
  tilePrice: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  tileMeta: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  tileFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
    minHeight: 38,
  },
  tileBadges: {
    flex: 1,
    gap: 2,
  },
  tileAddButton: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 2,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  tileAddText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  tileQuantity: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    minHeight: 38,
  },
  tileQuantityButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 32,
  },
  tileQuantityValue: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
    minWidth: 22,
    textAlign: "center",
  },
  itemTitle: {
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
