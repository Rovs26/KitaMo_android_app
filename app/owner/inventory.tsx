import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, formatPeso, MetricCard, Pill, ScreenScroll } from "@/components/ui/KitaMoUI";
import { createProduct, updateProduct } from "@/db/repositories";
import type { Product, ProductType, UnitType } from "@/domain/types";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { recordCookedBatch, recordSpoilage } from "@/services/stockOps";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, getUserSafeErrorMessage, logDevError } from "@/utils/errors";

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

type CookForm = {
  productId: string | null;
  quantity: string;
  note: string;
};

type SpoilageForm = {
  productId: string | null;
  quantity: string;
  reason: string;
};

const emptyCookForm: CookForm = { productId: null, quantity: "", note: "" };
const emptySpoilageForm: SpoilageForm = { productId: null, quantity: "", reason: "" };

export default function OwnerInventoryScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [showProductForm, setShowProductForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cookForm, setCookForm] = useState<CookForm>(emptyCookForm);
  const [spoilageForm, setSpoilageForm] = useState<SpoilageForm>(emptySpoilageForm);
  const [cookSaving, setCookSaving] = useState(false);
  const [spoilageSaving, setSpoilageSaving] = useState(false);
  const cookLock = useRef(false);
  const spoilageLock = useRef(false);
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
      setShowProductForm(false);
      await refresh();
      setMessage(productForm.id ? "Product updated." : "Product added.");
    } catch (error) {
      logDevError("OwnerInventory.saveProduct", error);
      setMessage(getFriendlyErrorMessage("Could not save product."));
    } finally {
      setSaving(false);
    }
  }

  async function saveCookedBatch() {
    if (cookLock.current) {
      return;
    }

    if (!cookForm.productId) {
      setMessage("Piliin muna kung anong paninda ang niluto.");
      return;
    }

    const quantity = parseNumber(cookForm.quantity, 0);
    if (quantity <= 0) {
      setMessage("Ilagay kung ilang piraso ang naluto.");
      return;
    }

    cookLock.current = true;
    setCookSaving(true);
    setMessage(null);
    try {
      const result = await recordCookedBatch({
        productId: cookForm.productId,
        quantity,
        note: cookForm.note,
      });
      setCookForm(emptyCookForm);
      await refresh();
      setMessage(`Nadagdag ang ${quantity} sa ${result.productName}. Stock is now ${result.newStockQty}.`);
    } catch (error) {
      logDevError("OwnerInventory.saveCookedBatch", error);
      setMessage(getUserSafeErrorMessage(error, "Could not save the cooked batch."));
    } finally {
      cookLock.current = false;
      setCookSaving(false);
    }
  }

  async function saveSpoilage() {
    if (spoilageLock.current) {
      return;
    }

    if (!spoilageForm.productId) {
      setMessage("Piliin muna kung anong paninda ang nasayang.");
      return;
    }

    const quantity = parseNumber(spoilageForm.quantity, 0);
    if (quantity <= 0) {
      setMessage("Ilagay kung ilang piraso ang nabawas.");
      return;
    }

    spoilageLock.current = true;
    setSpoilageSaving(true);
    setMessage(null);
    try {
      const result = await recordSpoilage({
        productId: spoilageForm.productId,
        quantity,
        reason: spoilageForm.reason,
      });
      setSpoilageForm(emptySpoilageForm);
      await refresh();
      setMessage(`Naitala ang ${quantity} na nasayang sa ${result.productName}. Stock is now ${result.newStockQty}.`);
    } catch (error) {
      logDevError("OwnerInventory.saveSpoilage", error);
      setMessage(getUserSafeErrorMessage(error, "Could not save the spoilage record."));
    } finally {
      spoilageLock.current = false;
      setSpoilageSaving(false);
    }
  }

  function editProduct(product: Product) {
    setShowProductForm(true);
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
  const products = status?.products ?? [];
  const lowStockCount = products.filter((product) => product.stockQty <= product.lowStockThreshold).length;
  const stockValue = products.reduce((total, product) => total + product.stockQty * product.cost, 0);
  const productFormVisible = products.length === 0 || showProductForm || Boolean(productForm.id);

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Paninda at sangkap" title="Inventory" />

      {message ? <Text style={[styles.message, { color: message.includes("Could not") ? palette.danger : palette.text }]}>{message}</Text> : null}

      <View style={styles.summaryGrid}>
        <MetricCard detail="Total items" icon="I" label="Products" tone="primary" value={String(products.length)} />
        <MetricCard detail="Need review" icon="!" label="Low Stock" tone={lowStockCount > 0 ? "warning" : "success"} value={`${lowStockCount} items`} />
        <MetricCard detail="Cost basis" icon="P" label="Stock Value" tone="success" value={formatPeso(stockValue)} />
      </View>

      <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Product List</Text>
          {products.length > 0 ? (
            <SmallButton
              disabled={saving || !canEditProducts}
              label="Add Product"
              onPress={() => {
                setProductForm(emptyProductForm);
                setShowProductForm(true);
              }}
            />
          ) : null}
        </View>
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
                    Stock: {product.stockQty} {product.unitType} · Price: {formatPeso(product.price)}
                  </Text>
                </View>
                <Pill label={product.stockQty <= 0 ? "Out" : lowStock ? "Low stock" : "Good"} tone={product.stockQty <= 0 ? "danger" : lowStock ? "warning" : "success"} />
              </View>
              <View style={styles.productMetaGrid}>
                <Text style={[styles.productMeta, { color: palette.mutedText }]}>Cost {formatPeso(product.cost)}</Text>
                <Text style={[styles.productMeta, { color: palette.mutedText }]}>Reorder {product.lowStockThreshold}</Text>
                <Text style={[styles.productMeta, { color: palette.mutedText }]}>{product.category}</Text>
              </View>
              {product.bundleLabel ? <Text style={[styles.body, { color: palette.mutedText }]}>Bundle: {product.bundleLabel}</Text> : null}
              <SmallButton disabled={saving} label="Edit" onPress={() => editProduct(product)} />
            </View>
          );
        })}
      </View>

      {products.length > 0 ? (
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Niluto / Produced</Text>
            <Pill label="Stock in" tone="success" />
          </View>
          <Text style={[styles.body, { color: palette.mutedText }]}>
            Ilang piraso ang nadagdag sa paninda? Stock will increase after saving.
          </Text>
          <ProductPicker
            disabled={cookSaving}
            label="Paninda"
            onSelect={(productId) => setCookForm((form) => ({ ...form, productId }))}
            products={products}
            selectedId={cookForm.productId}
          />
          <View style={styles.twoColumn}>
            <FormField
              editable={!cookSaving}
              keyboardType="decimal-pad"
              label="Dami (quantity)"
              onChangeText={(quantity) => setCookForm((form) => ({ ...form, quantity }))}
              placeholder="0"
              value={cookForm.quantity}
            />
            <FormField
              editable={!cookSaving}
              label="Note (optional)"
              onChangeText={(note) => setCookForm((form) => ({ ...form, note }))}
              placeholder="Example: umagang luto"
              value={cookForm.note}
            />
          </View>
          <ActionButton disabled={cookSaving} label={cookSaving ? "Saving..." : "Save Niluto"} onPress={saveCookedBatch} />
        </View>
      ) : null}

      {products.length > 0 ? (
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Nasayang / Spoilage</Text>
            <Pill label="Stock out" tone="danger" />
          </View>
          <Text style={[styles.body, { color: palette.mutedText }]}>
            Ilang piraso ang nabawas? Stock will decrease after saving.
          </Text>
          <ProductPicker
            disabled={spoilageSaving}
            label="Paninda"
            onSelect={(productId) => setSpoilageForm((form) => ({ ...form, productId }))}
            products={products}
            selectedId={spoilageForm.productId}
          />
          <View style={styles.twoColumn}>
            <FormField
              editable={!spoilageSaving}
              keyboardType="decimal-pad"
              label="Dami (quantity)"
              onChangeText={(quantity) => setSpoilageForm((form) => ({ ...form, quantity }))}
              placeholder="0"
              value={spoilageForm.quantity}
            />
            <FormField
              editable={!spoilageSaving}
              label="Reason (optional)"
              onChangeText={(reason) => setSpoilageForm((form) => ({ ...form, reason }))}
              placeholder="Example: nabasag, na-expire"
              value={spoilageForm.reason}
            />
          </View>
          <ActionButton disabled={spoilageSaving} label={spoilageSaving ? "Saving..." : "Save Nasayang"} onPress={saveSpoilage} />
        </View>
      ) : null}

      {productFormVisible ? (
        <View style={[styles.section, styles.formSection, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{productForm.id ? "Edit Product" : "Add Product"}</Text>
            {products.length > 0 ? (
              <SmallButton
                disabled={saving}
                label="Close"
                onPress={() => {
                  setProductForm(emptyProductForm);
                  setShowProductForm(false);
                }}
              />
            ) : null}
          </View>
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
            {productForm.id ? (
              <SmallButton
                disabled={saving}
                label="Cancel edit"
                onPress={() => {
                  setProductForm(emptyProductForm);
                  setShowProductForm(false);
                }}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </ScreenScroll>
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

type ProductPickerProps = {
  label: string;
  products: Product[];
  selectedId: string | null;
  onSelect: (productId: string) => void;
  disabled?: boolean;
};

function ProductPicker({ label, products, selectedId, onSelect, disabled = false }: ProductPickerProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text>
      <View style={styles.optionWrap}>
        {products.map((product) => {
          const selected = product.id === selectedId;
          return (
            <Pressable
              disabled={disabled}
              key={product.id}
              onPress={() => onSelect(product.id)}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? palette.primary : palette.background,
                  borderColor: selected ? palette.primary : palette.border,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: selected ? palette.kioskHeaderText : palette.text }]}>{product.name}</Text>
            </Pressable>
          );
        })}
      </View>
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
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
    padding: 14,
  },
  formSection: {
    opacity: 0.98,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
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
    minHeight: 42,
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
    padding: 12,
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
  productMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  productMeta: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
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
