import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, EmptyState, formatPeso, InlineNotice, LoadingState, MetricCard, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { createProduct, updateProduct } from "@/db/repositories";
import type { Product, ProductType, UnitType } from "@/domain/types";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { recordCookedBatch, recordSpoilage } from "@/services/stockOps";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
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
  initialStockQty: string | null;
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
  initialStockQty: null,
  lowStockThreshold: "",
  price: "",
  cost: "",
  bundleQuantity: "",
  bundlePrice: "",
  bundleLabel: "",
};

const numbersOnlyMessage = "Numbers only, like 1500 or 12.5. Walang comma.";

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
  const [messageIsError, setMessageIsError] = useState(false);
  const [cookForm, setCookForm] = useState<CookForm>(emptyCookForm);
  const [spoilageForm, setSpoilageForm] = useState<SpoilageForm>(emptySpoilageForm);
  const [cookMessage, setCookMessage] = useState<string | null>(null);
  const [cookIsError, setCookIsError] = useState(false);
  const [spoilageMessage, setSpoilageMessage] = useState<string | null>(null);
  const [spoilageIsError, setSpoilageIsError] = useState(false);
  const [cookSaving, setCookSaving] = useState(false);
  const [spoilageSaving, setSpoilageSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const cookLock = useRef(false);
  const spoilageLock = useRef(false);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const router = useRouter();

  function setNotice(text: string) {
    setMessage(text);
    setMessageIsError(false);
  }

  function setError(text: string) {
    setMessage(text);
    setMessageIsError(true);
  }

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
          setMessageIsError(true);
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  async function saveProduct() {
    if (!status?.activeBusiness) {
      setError("Create your business profile before adding products.");
      return;
    }

    const name = productForm.name.trim();
    if (!name) {
      setError("Product name is required.");
      return;
    }

    const stockQty = parseRequiredNumber(productForm.stockQty, 0);
    const lowStockThreshold = parseRequiredNumber(productForm.lowStockThreshold, 0);
    const price = parseRequiredNumber(productForm.price, 0);
    const cost = parseRequiredNumber(productForm.cost, 0);
    const bundleQuantity = parseOptionalStrictNumber(productForm.bundleQuantity);
    const bundlePrice = parseOptionalStrictNumber(productForm.bundlePrice);

    if (
      stockQty === "invalid" ||
      lowStockThreshold === "invalid" ||
      price === "invalid" ||
      cost === "invalid" ||
      bundleQuantity === "invalid" ||
      bundlePrice === "invalid"
    ) {
      setError(numbersOnlyMessage);
      return;
    }

    if ([stockQty, lowStockThreshold, price, cost].some((value) => value < 0)) {
      setError("Stock, threshold, selling price, and unit cost cannot be negative.");
      return;
    }

    if (bundleQuantity !== null && bundleQuantity <= 0) {
      setError("Bundle quantity must be greater than zero.");
      return;
    }

    if (bundlePrice !== null && bundlePrice < 0) {
      setError("Bundle price cannot be negative.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const sharedFields = {
        name,
        category: productForm.category.trim() || "General",
        productType: productForm.productType,
        unitType: productForm.unitType,
        lowStockThreshold,
        price,
        cost,
        bundleQuantity,
        bundlePrice,
        bundleLabel: productForm.bundleLabel.trim() || null,
      };

      if (productForm.id) {
        const stockChanged = productForm.stockQty.trim() !== (productForm.initialStockQty ?? "").trim();
        await updateProduct(productForm.id, {
          ...sharedFields,
          ...(stockChanged ? { stockQty } : {}),
        });
      } else {
        await createProduct({
          ...sharedFields,
          stockQty,
          branchId: status.activeBranch?.id ?? null,
          active: true,
          businessId: status.activeBusiness.id,
        });
      }

      setProductForm(emptyProductForm);
      setShowProductForm(false);
      await refresh();
      setNotice(productForm.id ? "Product updated." : "Product added.");
    } catch (error) {
      logDevError("OwnerInventory.saveProduct", error);
      setError(getFriendlyErrorMessage("Could not save product."));
    } finally {
      setSaving(false);
    }
  }

  async function saveCookedBatch() {
    if (cookLock.current) {
      return;
    }

    if (!cookForm.productId) {
      setCookMessage("Piliin muna kung anong paninda ang niluto.");
      setCookIsError(true);
      return;
    }

    const quantity = parseRequiredNumber(cookForm.quantity, 0);
    if (quantity === "invalid") {
      setCookMessage(numbersOnlyMessage);
      setCookIsError(true);
      return;
    }

    if (quantity <= 0) {
      setCookMessage("Ilagay kung ilang piraso ang naluto.");
      setCookIsError(true);
      return;
    }

    cookLock.current = true;
    setCookSaving(true);
    setCookMessage(null);
    try {
      const result = await recordCookedBatch({
        productId: cookForm.productId,
        quantity,
        note: cookForm.note,
      });
      setCookForm(emptyCookForm);
      await refresh();
      setCookMessage(`Stock updated. Nadagdag ang ${quantity} sa ${result.productName} (${result.newStockQty} na ngayon).`);
      setCookIsError(false);
    } catch (error) {
      logDevError("OwnerInventory.saveCookedBatch", error);
      setCookMessage(getUserSafeErrorMessage(error, "Could not save the cooked batch."));
      setCookIsError(true);
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
      setSpoilageMessage("Piliin muna kung anong paninda ang nasayang.");
      setSpoilageIsError(true);
      return;
    }

    const quantity = parseRequiredNumber(spoilageForm.quantity, 0);
    if (quantity === "invalid") {
      setSpoilageMessage(numbersOnlyMessage);
      setSpoilageIsError(true);
      return;
    }

    if (quantity <= 0) {
      setSpoilageMessage("Ilagay kung ilang piraso ang nabawas.");
      setSpoilageIsError(true);
      return;
    }

    spoilageLock.current = true;
    setSpoilageSaving(true);
    setSpoilageMessage(null);
    try {
      const result = await recordSpoilage({
        productId: spoilageForm.productId,
        quantity,
        reason: spoilageForm.reason,
      });
      setSpoilageForm(emptySpoilageForm);
      await refresh();
      setSpoilageMessage(`Stock updated. Nabawas ang ${quantity} sa ${result.productName} (${result.newStockQty} na lang).`);
      setSpoilageIsError(false);
    } catch (error) {
      logDevError("OwnerInventory.saveSpoilage", error);
      setSpoilageMessage(getUserSafeErrorMessage(error, "Could not save the spoilage record."));
      setSpoilageIsError(true);
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
      initialStockQty: String(product.stockQty),
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
  const productFormVisible = Boolean(status) && (products.length === 0 || showProductForm || Boolean(productForm.id));
  const visibleProducts = products.filter((product) => {
    const matchesSearch = `${product.name} ${product.category}`.toLocaleLowerCase().includes(productSearch.trim().toLocaleLowerCase());
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "out" ? product.stockQty <= 0 : product.stockQty > 0 && product.stockQty <= product.lowStockThreshold);
    return matchesSearch && matchesStock;
  });

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Paninda at sangkap" title="Inventory" />

      {message ? <InlineNotice message={message} tone={messageIsError ? "danger" : "success"} /> : null}

      {!status ? (
        <LoadingState label="Loading products and stock levels..." />
      ) : (
        <View style={styles.summaryGrid}>
          <MetricCard detail="Total items" icon="I" label="Products" tone="primary" value={String(products.length)} />
          <MetricCard detail="Need review" icon="!" label="Low Stock" tone={lowStockCount > 0 ? "warning" : "success"} value={`${lowStockCount} items`} />
          <MetricCard detail="Cost basis" icon="P" label="Stock Value" tone="success" value={formatPeso(stockValue)} />
        </View>
      )}

      <View style={styles.linkGrid}>
        <View style={styles.linkCell}>
          <SecondaryButton href="/owner/grocery" label="Grocery Stock" />
        </View>
        <View style={styles.linkCell}>
          <SecondaryButton href="/owner/recipes" label="Recipes" />
        </View>
        <View style={styles.linkCell}>
          <SecondaryButton href="/owner/production" label="Niluto" />
        </View>
        <View style={styles.linkCell}>
          <SecondaryButton href="/owner/transfers" label="Transfers" />
        </View>
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
        {products.length > 0 ? (
          <>
            <TextInput
              onChangeText={setProductSearch}
              placeholder="Search product or category"
              placeholderTextColor={palette.mutedText}
              style={[styles.searchInput, { backgroundColor: palette.background, borderColor: palette.border, color: palette.text }]}
              value={productSearch}
            />
            <View style={styles.stockFilters}>
              {(["all", "low", "out"] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setStockFilter(option)}
                  style={[
                    styles.stockFilter,
                    {
                      backgroundColor: stockFilter === option ? palette.primary : palette.background,
                      borderColor: stockFilter === option ? palette.primary : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.stockFilterText, { color: stockFilter === option ? palette.kioskHeaderText : palette.text }]}>
                    {option === "all" ? "All" : option === "low" ? "Low stock" : "Out of stock"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        {status && status.products.length === 0 ? (
          <Text style={[styles.empty, { color: palette.mutedText }]}>Add your first paninda</Text>
        ) : null}

        {status && products.length > 0 && visibleProducts.length === 0 ? (
          <EmptyState description="Try another search or stock filter." title="No matching products" />
        ) : null}

        {visibleProducts.map((product) => {
          const lowStock = product.stockQty <= product.lowStockThreshold;
          return (
            <View key={product.id} style={[styles.productRow, { backgroundColor: palette.background }]}>
              <View style={styles.productHeader}>
                <View style={styles.productText}>
                  <Text style={[styles.productName, { color: palette.text }]}>{product.name}</Text>
                  <Text style={[styles.body, { color: palette.mutedText }]}>
                    Stock: {product.stockQty} {product.unitType} · Price: {formatPeso(product.price)}
                  </Text>
                </View>
                <View style={styles.productHeaderRight}>
                  <Pressable disabled={saving} hitSlop={8} onPress={() => editProduct(product)}>
                    <Text style={[styles.editLink, { color: palette.primary, opacity: saving ? 0.5 : 1 }]}>Edit</Text>
                  </Pressable>
                  <Pill label={product.stockQty <= 0 ? "Out" : lowStock ? "Low stock" : "Good"} tone={product.stockQty <= 0 ? "danger" : lowStock ? "warning" : "success"} />
                </View>
              </View>
              <View style={styles.productMetaGrid}>
                <Text style={[styles.productMeta, { color: palette.mutedText }]}>Cost {formatPeso(product.cost)}</Text>
                <Text style={[styles.productMeta, { color: palette.mutedText }]}>Reorder {product.lowStockThreshold}</Text>
                <Text style={[styles.productMeta, { color: palette.mutedText }]}>{product.category}</Text>
              </View>
              {product.bundleLabel ? <Text style={[styles.body, { color: palette.mutedText }]}>Bundle: {product.bundleLabel}</Text> : null}
            </View>
          );
        })}
      </View>

      {products.length > 0 ? (
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Niluto ngayon</Text>
              <Text style={[styles.sectionHint, { color: palette.mutedText }]}>Idagdag sa stock ang bagong luto</Text>
            </View>
            <Pill label="Stock in" tone="success" />
          </View>

          <View style={styles.stockField}>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Anong paninda?</Text>
            <ProductChips
              disabled={cookSaving}
              onSelect={(productId) => setCookForm((form) => ({ ...form, productId }))}
              products={products}
              selectedId={cookForm.productId}
            />
          </View>

          <View style={styles.twoColumn}>
            <FormField
              editable={!cookSaving}
              keyboardType="decimal-pad"
              label="Ilang piraso?"
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

          {cookMessage ? (
            <Text style={[styles.body, { color: cookIsError ? palette.danger : palette.text }]}>{cookMessage}</Text>
          ) : null}

          <ActionButton disabled={cookSaving} label={cookSaving ? "Saving..." : "I-save ang niluto"} onPress={saveCookedBatch} />

          <Pressable hitSlop={6} onPress={() => router.push("/owner/production")} style={styles.recipeLink}>
            <Text style={[styles.recipeLinkText, { color: palette.primary }]}>May recipe? Buksan ang Niluto para automatic ang sangkap →</Text>
          </Pressable>
        </View>
      ) : null}

      {products.length > 0 ? (
        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Nasayang</Text>
              <Text style={[styles.sectionHint, { color: palette.mutedText }]}>Bawasan ang stock kapag may nasira</Text>
            </View>
            <Pill label="Stock out" tone="danger" />
          </View>

          <View style={styles.stockField}>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Anong paninda?</Text>
            <ProductChips
              disabled={spoilageSaving}
              onSelect={(productId) => setSpoilageForm((form) => ({ ...form, productId }))}
              products={products}
              selectedId={spoilageForm.productId}
            />
          </View>

          <View style={styles.twoColumn}>
            <FormField
              editable={!spoilageSaving}
              keyboardType="decimal-pad"
              label="Ilang piraso?"
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

          {spoilageMessage ? (
            <Text style={[styles.body, { color: spoilageIsError ? palette.danger : palette.text }]}>{spoilageMessage}</Text>
          ) : null}

          <ActionButton disabled={spoilageSaving} label={spoilageSaving ? "Saving..." : "I-save ang nasayang"} onPress={saveSpoilage} />
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

function parseRequiredNumber(value: string, fallback: number): number | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.includes(",")) {
    return "invalid";
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

function parseOptionalStrictNumber(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(",")) {
    return "invalid";
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : "invalid";
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

type ProductChipsProps = {
  products: Product[];
  selectedId: string | null;
  onSelect: (productId: string) => void;
  disabled?: boolean;
};

function ProductChips({ products, selectedId, onSelect, disabled = false }: ProductChipsProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <ScrollView
      contentContainerStyle={styles.chipRow}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      {products.map((product) => {
        const selected = product.id === selectedId;
        return (
          <Pressable
            disabled={disabled}
            key={product.id}
            onPress={() => onSelect(product.id)}
            style={[
              styles.productChip,
              {
                backgroundColor: selected ? palette.primary : palette.background,
                borderColor: selected ? palette.primary : palette.border,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.productChipText, { color: selected ? palette.kioskHeaderText : palette.text }]}>{product.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
  linkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  linkCell: {
    flexBasis: "47%",
    flexGrow: 1,
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
  searchInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stockFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  stockFilter: {
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  stockFilterText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  section: {
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.card,
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
  sectionHeaderText: {
    flex: 1,
    gap: 2,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  stockField: {
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: 2,
  },
  productChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  productChipText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  recipeLink: {
    paddingTop: spacing.xs,
  },
  recipeLinkText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
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
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.sm + 2,
  },
  productHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  productHeaderRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  editLink: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
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
