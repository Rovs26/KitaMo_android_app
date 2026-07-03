import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { createProduct, updateProduct } from "@/db/repositories";
import type { Product, ProductType, UnitType } from "@/domain/types";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

const productTypes: ProductType[] = ["retail item", "cooked food", "ingredient-based item", "service/other"];
const unitTypes: UnitType[] = ["piece", "bottle", "pack", "sachet", "kilo", "serving", "case", "tray", "other"];

type ProductForm = {
  id: string | null;
  name: string;
  category: string;
  productType: ProductType;
  unitType: UnitType;
  stockQty: string;
  lowStockThreshold: string;
  price: string;
  cost: string;
  bundleQuantity: string;
  bundlePrice: string;
  bundleLabel: string;
};

const emptyProductForm: ProductForm = {
  id: null,
  name: "",
  category: "",
  productType: "retail item",
  unitType: "piece",
  stockQty: "",
  lowStockThreshold: "",
  price: "",
  cost: "",
  bundleQuantity: "",
  bundlePrice: "",
  bundleLabel: "",
};

export default function OwnerInventoryScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextStatus = await loadOwnerSetupStatus();
    setStatus(nextStatus);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      refresh().catch((error) => {
        logDevError("OwnerInventory.refresh", error);
        if (active) {
          setMessage(getFriendlyErrorMessage("Could not load inventory."));
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  async function saveProduct() {
    if (!status?.activeBusiness) {
      setMessage("Create your business profile before adding products.");
      return;
    }

    const name = productForm.name.trim();
    if (!name) {
      setMessage("Product name is required.");
      return;
    }

    const stockQty = parseNumber(productForm.stockQty, 0);
    const lowStockThreshold = parseNumber(productForm.lowStockThreshold, 0);
    const price = parseNumber(productForm.price, 0);
    const cost = parseNumber(productForm.cost, 0);
    const bundleQuantity = parseOptionalNumber(productForm.bundleQuantity);
    const bundlePrice = parseOptionalNumber(productForm.bundlePrice);

    if ([stockQty, lowStockThreshold, price, cost].some((value) => value < 0)) {
      setMessage("Stock, threshold, selling price, and unit cost cannot be negative.");
      return;
    }

    if (bundleQuantity !== null && bundleQuantity <= 0) {
      setMessage("Bundle quantity must be greater than zero.");
      return;
    }

    if (bundlePrice !== null && bundlePrice < 0) {
      setMessage("Bundle price cannot be negative.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        branchId: status.activeBranch?.id ?? null,
        name,
        category: productForm.category.trim() || "General",
        productType: productForm.productType,
        unitType: productForm.unitType,
        stockQty,
        lowStockThreshold,
        price,
        cost,
        bundleQuantity,
        bundlePrice,
        bundleLabel: productForm.bundleLabel.trim() || null,
        active: true,
      };

      if (productForm.id) {
        await updateProduct(productForm.id, payload);
      } else {
        await createProduct({
          ...payload,
          businessId: status.activeBusiness.id,
        });
      }

      setProductForm(emptyProductForm);
      await refresh();
      setMessage(productForm.id ? "Product updated." : "Product added.");
    } catch (error) {
      logDevError("OwnerInventory.saveProduct", error);
      setMessage(getFriendlyErrorMessage("Could not save product."));
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product: Product) {
    setProductForm({
      id: product.id,
      name: product.name,
      category: product.category,
      productType: product.productType,
      unitType: product.unitType,
      stockQty: String(product.stockQty),
      lowStockThreshold: String(product.lowStockThreshold),
      price: String(product.price),
      cost: String(product.cost),
      bundleQuantity: product.bundleQuantity === null ? "" : String(product.bundleQuantity),
      bundlePrice: product.bundlePrice === null ? "" : String(product.bundlePrice),
      bundleLabel: product.bundleLabel ?? "",
    });
  }

  const canEditProducts = Boolean(status?.activeBusiness);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>Owner</Text>
        <Text style={[styles.title, { color: palette.text }]}>Inventory</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>Manage paninda, stock, and prices for the active stall.</Text>
      </View>

      {message ? <Text style={[styles.message, { color: message.includes("Could not") ? palette.danger : palette.text }]}>{message}</Text> : null}

      <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{productForm.id ? "Edit Product" : "Product Setup"}</Text>
        {!status?.activeBusiness ? (
          <Text style={[styles.empty, { color: palette.mutedText }]}>Create a business profile before adding products.</Text>
        ) : null}

        <FormField
          editable={canEditProducts}
          label="Product name"
          onChangeText={(name) => setProductForm((form) => ({ ...form, name }))}
          placeholder="Example: Bottled water"
          value={productForm.name}
        />
        <FormField
          editable={canEditProducts}
          label="Category/type"
          onChangeText={(category) => setProductForm((form) => ({ ...form, category }))}
          placeholder="Drinks, meals, snacks"
          value={productForm.category}
        />
        <OptionGroup
          disabled={!canEditProducts}
          label="Product kind"
          onSelect={(productType) => setProductForm((form) => ({ ...form, productType }))}
          options={productTypes}
          selected={productForm.productType}
        />
        <OptionGroup
          disabled={!canEditProducts}
          label="Unit"
          onSelect={(unitType) => setProductForm((form) => ({ ...form, unitType }))}
          options={unitTypes}
          selected={productForm.unitType}
        />

        <View style={styles.twoColumn}>
          <FormField
            editable={canEditProducts}
            keyboardType="decimal-pad"
            label="Stock qty"
            onChangeText={(stockQty) => setProductForm((form) => ({ ...form, stockQty }))}
            placeholder="0"
            value={productForm.stockQty}
          />
          <FormField
            editable={canEditProducts}
            keyboardType="decimal-pad"
            label="Low-stock threshold"
            onChangeText={(lowStockThreshold) => setProductForm((form) => ({ ...form, lowStockThreshold }))}
            placeholder="0"
            value={productForm.lowStockThreshold}
          />
        </View>

        <View style={styles.twoColumn}>
          <FormField
            editable={canEditProducts}
            keyboardType="decimal-pad"
            label="Selling price"
            onChangeText={(price) => setProductForm((form) => ({ ...form, price }))}
            placeholder="0"
            value={productForm.price}
          />
          <FormField
            editable={canEditProducts}
            keyboardType="decimal-pad"
            label="Unit cost"
            onChangeText={(cost) => setProductForm((form) => ({ ...form, cost }))}
            placeholder="0"
            value={productForm.cost}
          />
        </View>

        <View style={styles.twoColumn}>
          <FormField
            editable={canEditProducts}
            keyboardType="decimal-pad"
            label="Bundle quantity"
            onChangeText={(bundleQuantity) => setProductForm((form) => ({ ...form, bundleQuantity }))}
            placeholder="Optional"
            value={productForm.bundleQuantity}
          />
          <FormField
            editable={canEditProducts}
            keyboardType="decimal-pad"
            label="Bundle price"
            onChangeText={(bundlePrice) => setProductForm((form) => ({ ...form, bundlePrice }))}
            placeholder="Optional"
            value={productForm.bundlePrice}
          />
        </View>
        <FormField
          editable={canEditProducts}
          label="Bundle label"
          onChangeText={(bundleLabel) => setProductForm((form) => ({ ...form, bundleLabel }))}
          placeholder="Example: 3 for PHP 100"
          value={productForm.bundleLabel}
        />

        <View style={styles.inlineActions}>
          <ActionButton disabled={saving || !canEditProducts} label={productForm.id ? "Save Product" : "Add Product"} onPress={saveProduct} />
          {productForm.id ? <SmallButton disabled={saving} label="Cancel edit" onPress={() => setProductForm(emptyProductForm)} /> : null}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Product List</Text>
        {status && status.products.length === 0 ? (
          <Text style={[styles.empty, { color: palette.mutedText }]}>Add your first paninda</Text>
        ) : null}

        {status?.products.map((product) => {
          const lowStock = product.stockQty <= product.lowStockThreshold;
          return (
            <View key={product.id} style={[styles.productRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.productHeader}>
                <View style={styles.productText}>
                  <Text style={[styles.productName, { color: palette.text }]}>{product.name}</Text>
                  <Text style={[styles.body, { color: palette.mutedText }]}>
                    {product.stockQty} {product.unitType} | PHP {product.price.toFixed(2)}
                  </Text>
                </View>
                {lowStock ? (
                  <Text style={[styles.badge, { backgroundColor: palette.warning, color: palette.kioskHeaderText }]}>Low stock</Text>
                ) : null}
              </View>
              <Text style={[styles.body, { color: palette.mutedText }]}>
                Category: {product.category} | Threshold: {product.lowStockThreshold}
              </Text>
              {product.bundleLabel ? <Text style={[styles.body, { color: palette.mutedText }]}>Bundle: {product.bundleLabel}</Text> : null}
              <SmallButton disabled={saving} label="Edit" onPress={() => editProduct(product)} />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function parseNumber(value: string, fallback: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  editable?: boolean;
};

function FormField({ label, value, onChangeText, placeholder, keyboardType = "default", editable = true }: FormFieldProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        style={[
          styles.input,
          {
            backgroundColor: editable ? palette.background : palette.surface,
            borderColor: palette.border,
            color: palette.text,
            opacity: editable ? 1 : 0.65,
          },
        ]}
        value={value}
      />
    </View>
  );
}

type OptionGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
};

function OptionGroup<T extends string>({ label, options, selected, onSelect, disabled = false }: OptionGroupProps<T>) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text>
      <View style={styles.optionWrap}>
        {options.map((option) => {
          const selectedOption = option === selected;
          return (
            <Pressable
              disabled={disabled}
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.option,
                {
                  backgroundColor: selectedOption ? palette.primary : palette.background,
                  borderColor: selectedOption ? palette.primary : palette.border,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: selectedOption ? palette.kioskHeaderText : palette.text }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

function ActionButton({ label, onPress, disabled = false }: ButtonProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, { backgroundColor: palette.primary, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={[styles.actionButtonText, { color: palette.kioskHeaderText }]}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress, disabled = false }: ButtonProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.smallButton, { borderColor: palette.border, opacity: disabled ? 0.55 : 1 }]}
    >
      <Text style={[styles.smallButtonText, { color: palette.primary }]}>{label}</Text>
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
  message: {
    ...typography.body,
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
  },
  empty: {
    ...typography.body,
  },
  field: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 132,
  },
  fieldLabel: {
    ...typography.button,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  twoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  inlineActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 44,
    minWidth: 160,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionButtonText: {
    ...typography.button,
  },
  smallButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  productRow: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  productHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  productText: {
    flex: 1,
    gap: spacing.xs,
  },
  productName: {
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
});
