import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, formatQuantity, MetricCard, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { ingredientUnits } from "@/db/repositories";
import type { IngredientUnit } from "@/domain/types";
import { addGroceryPurchase, loadGroceryPoolSnapshot, type GroceryPoolSnapshot } from "@/services/groceryPool";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, getUserSafeErrorMessage, logDevError } from "@/utils/errors";
import { numbersOnlyMessage, parseOptionalStrictNumber, parseRequiredNumber } from "@/utils/numberInput";

type GroceryForm = {
  ingredientName: string;
  brandName: string;
  sourceName: string;
  quantity: string;
  unit: IngredientUnit;
  totalCost: string;
  purchaseDate: string;
  lowStockThreshold: string;
  notes: string;
};

const emptyGroceryForm: GroceryForm = {
  ingredientName: "",
  brandName: "",
  sourceName: "",
  quantity: "",
  unit: "kg",
  totalCost: "",
  purchaseDate: "",
  lowStockThreshold: "",
  notes: "",
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export default function OwnerGroceryScreen() {
  const [snapshot, setSnapshot] = useState<GroceryPoolSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<GroceryForm>(emptyGroceryForm);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formIsError, setFormIsError] = useState(false);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextSnapshot = await loadGroceryPoolSnapshot();
    setSnapshot(nextSnapshot);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh()
        .then(() => {
          if (active) {
            setLoadError(null);
          }
        })
        .catch((error) => {
          logDevError("OwnerGrocery.refresh", error);
          if (active) {
            setLoadError(getFriendlyErrorMessage("Could not load the grocery pool."));
          }
        });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const lowStockIngredientIds = useMemo(
    () => new Set(snapshot?.lowStockIngredients.map((entry) => entry.ingredient.id) ?? []),
    [snapshot?.lowStockIngredients],
  );

  const filteredLots = useMemo(() => {
    const lots = snapshot?.lots ?? [];
    const query = filter.trim().toLowerCase();
    if (!query) {
      return lots;
    }

    return lots.filter((lot) =>
      [lot.ingredientName, lot.brandName ?? "", lot.sourceName ?? ""].some((value) => value.toLowerCase().includes(query)),
    );
  }, [snapshot?.lots, filter]);

  const costPreview = useMemo(() => {
    const quantity = parseRequiredNumber(form.quantity, 0);
    const totalCost = parseRequiredNumber(form.totalCost, 0);
    if (quantity === "invalid" || totalCost === "invalid" || quantity <= 0 || totalCost <= 0) {
      return null;
    }

    return `${formatPeso(totalCost / quantity)} per ${form.unit}`;
  }, [form.quantity, form.totalCost, form.unit]);

  async function saveGroceryPurchase() {
    if (saveLock.current) {
      return;
    }

    if (!snapshot?.hasBusiness) {
      setFormMessage("Create your business profile in Owner Settings first.");
      setFormIsError(true);
      return;
    }

    const ingredientName = form.ingredientName.trim();
    if (!ingredientName) {
      setFormMessage("Ilagay ang pangalan ng grocery item. Example: Rice.");
      setFormIsError(true);
      return;
    }

    const quantity = parseRequiredNumber(form.quantity, 0);
    const totalCost = parseRequiredNumber(form.totalCost, 0);
    const lowStockThreshold = parseOptionalStrictNumber(form.lowStockThreshold);

    if (quantity === "invalid" || totalCost === "invalid" || lowStockThreshold === "invalid") {
      setFormMessage(numbersOnlyMessage);
      setFormIsError(true);
      return;
    }

    if (quantity <= 0) {
      setFormMessage("Ilagay kung gaano karami ang binili. Example: 10.");
      setFormIsError(true);
      return;
    }

    if (totalCost <= 0) {
      setFormMessage("Ilagay ang total na binayaran. Example: 650.");
      setFormIsError(true);
      return;
    }

    if (lowStockThreshold !== null && lowStockThreshold < 0) {
      setFormMessage("Low-stock alert cannot be negative.");
      setFormIsError(true);
      return;
    }

    const purchaseDate = form.purchaseDate.trim();
    if (purchaseDate && !isValidIsoDate(purchaseDate)) {
      setFormMessage("Date should look like 2026-07-05. Leave it blank for today.");
      setFormIsError(true);
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setFormMessage(null);
    try {
      const result = await addGroceryPurchase({
        ingredientName,
        brandName: form.brandName.trim() || null,
        sourceName: form.sourceName.trim() || null,
        quantity,
        unit: form.unit,
        totalCost,
        purchaseDate: purchaseDate || null,
        lowStockThreshold,
        notes: form.notes.trim() || null,
      });

      setForm((current) => ({ ...emptyGroceryForm, unit: current.unit }));
      setFormMessage(
        `Saved locally on this device. ${result.ingredient.name}: ${formatPeso(result.costPerUnit)} per ${result.lot.unit}.`,
      );
      setFormIsError(false);

      try {
        await refresh();
      } catch (refreshError) {
        logDevError("OwnerGrocery.refreshAfterSave", refreshError);
        setLoadError(getFriendlyErrorMessage("Could not reload the grocery list. Balikan ang screen na ito."));
      }
    } catch (error) {
      logDevError("OwnerGrocery.saveGroceryPurchase", error);
      setFormMessage(getUserSafeErrorMessage(error, "Could not save the grocery item."));
      setFormIsError(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const hasLots = (snapshot?.lots.length ?? 0) > 0;

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="I-track ang grocery at sangkap bago ang recipe costing." title="Grocery Stock" />

      {loadError ? <Text style={[styles.body, { color: palette.danger }]}>{loadError}</Text> : null}

      <View style={styles.metricGrid}>
        <MetricCard detail="Remaining stock value" icon="₱" label="Grocery Value" tone="primary" value={formatPeso(snapshot?.totalRemainingValue ?? 0)} />
        <MetricCard detail="Saved sa pool" icon="I" label="Ingredients" tone="success" value={String(snapshot?.ingredientCount ?? 0)} />
        <MetricCard
          detail="Need review"
          icon="!"
          label="Low stock"
          tone={(snapshot?.lowStockIngredients.length ?? 0) > 0 ? "warning" : "success"}
          value={String(snapshot?.lowStockIngredients.length ?? 0)}
        />
        <MetricCard detail="Last 7 days" icon="G" label="Purchases" tone="accent" value={String(snapshot?.recentLotCount ?? 0)} />
      </View>

      <SecondaryButton href="/owner/recipes" label="Use ingredients in a recipe" />

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Add grocery item</Text>
        {!snapshot?.hasBusiness && snapshot ? (
          <Text style={[styles.body, { color: palette.warning }]}>Create your business profile in Owner Settings first.</Text>
        ) : null}

        <FormField
          editable={!saving}
          label="Ingredient"
          onChangeText={(ingredientName) => setForm((current) => ({ ...current, ingredientName }))}
          placeholder="Example: Rice, Soy sauce, Cucumber"
          value={form.ingredientName}
        />

        <View style={styles.twoColumn}>
          <FormField
            editable={!saving}
            label="Brand (optional)"
            onChangeText={(brandName) => setForm((current) => ({ ...current, brandName }))}
            placeholder="Example: Kikkoman"
            value={form.brandName}
          />
          <FormField
            editable={!saving}
            label="Source (optional)"
            onChangeText={(sourceName) => setForm((current) => ({ ...current, sourceName }))}
            placeholder="Grocery, palengke, supplier"
            value={form.sourceName}
          />
        </View>

        <View style={styles.twoColumn}>
          <FormField
            editable={!saving}
            keyboardType="decimal-pad"
            label="Quantity"
            onChangeText={(quantity) => setForm((current) => ({ ...current, quantity }))}
            placeholder="Example: 10"
            value={form.quantity}
          />
          <FormField
            editable={!saving}
            keyboardType="decimal-pad"
            label="Total cost"
            onChangeText={(totalCost) => setForm((current) => ({ ...current, totalCost }))}
            placeholder="Example: 650"
            value={form.totalCost}
          />
        </View>

        <UnitPicker disabled={saving} onSelect={(unit) => setForm((current) => ({ ...current, unit }))} selected={form.unit} />

        {costPreview ? (
          <Text style={[styles.costPreview, { color: palette.primary }]}>Cost per unit: {costPreview}</Text>
        ) : null}

        <View style={styles.twoColumn}>
          <FormField
            editable={!saving}
            label="Purchase date (optional)"
            onChangeText={(purchaseDate) => setForm((current) => ({ ...current, purchaseDate }))}
            placeholder="Blank = today"
            value={form.purchaseDate}
          />
          <FormField
            editable={!saving}
            keyboardType="decimal-pad"
            label="Low-stock alert (optional)"
            onChangeText={(lowStockThreshold) => setForm((current) => ({ ...current, lowStockThreshold }))}
            placeholder="Example: 2"
            value={form.lowStockThreshold}
          />
        </View>

        <FormField
          editable={!saving}
          label="Notes (optional)"
          onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
          placeholder="Example: pang-sushi na bigas"
          value={form.notes}
        />

        {formMessage ? (
          <Text style={[styles.body, { color: formIsError ? palette.danger : palette.success }]}>{formMessage}</Text>
        ) : null}

        <Pressable
          disabled={saving || !snapshot?.hasBusiness}
          onPress={saveGroceryPurchase}
          style={[styles.saveButton, { backgroundColor: palette.primary, opacity: saving || !snapshot?.hasBusiness ? 0.6 : 1 }]}
        >
          <Text style={[styles.saveButtonText, { color: palette.kioskHeaderText }]}>{saving ? "Saving..." : "Save Grocery Item"}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Grocery stock</Text>

        {hasLots ? (
          <TextInput
            onChangeText={setFilter}
            placeholder="Search ingredient, brand, o source"
            placeholderTextColor={palette.mutedText}
            style={[styles.filterInput, { backgroundColor: palette.background, borderColor: palette.border, color: palette.text }]}
            value={filter}
          />
        ) : null}

        {snapshot && !hasLots ? (
          <EmptyState description="Example: Rice, 10kg, ₱650." title="Add your first grocery item." />
        ) : null}

        {hasLots && filteredLots.length === 0 ? (
          <Text style={[styles.body, { color: palette.mutedText }]}>Walang tugma. Try another ingredient, brand, o source.</Text>
        ) : null}

        {filteredLots.map((lot) => {
          const depleted = lot.remainingQuantity <= 0;
          const lowStock = !depleted && lowStockIngredientIds.has(lot.ingredientId);
          const remainingValue = lot.remainingQuantity * lot.costPerUnit;

          return (
            <View key={lot.id} style={[styles.lotRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.lotHeader}>
                <View style={styles.lotText}>
                  <Text style={[styles.itemTitle, { color: palette.text }]}>
                    {lot.ingredientName}
                    {lot.brandName ? ` · ${lot.brandName}` : ""}
                  </Text>
                  <Text style={[styles.helper, { color: palette.mutedText }]}>
                    {lot.sourceName ? `${lot.sourceName} · ` : ""}
                    {formatDate(lot.purchaseDate)}
                  </Text>
                </View>
                {depleted ? (
                  <Pill label="Ubos na" tone="neutral" />
                ) : lowStock ? (
                  <Pill label="Low stock" tone="warning" />
                ) : (
                  <Pill label="In stock" tone="success" />
                )}
              </View>

              <View style={styles.lotMetaGrid}>
                <Text style={[styles.lotMeta, { color: palette.text }]}>
                  {formatQuantity(lot.remainingQuantity)} {lot.unit} left of {formatQuantity(lot.purchasedQuantity)} {lot.unit}
                </Text>
                <Text style={[styles.lotMeta, { color: palette.primary }]}>{formatPeso(remainingValue)} value</Text>
                <Text style={[styles.lotMeta, { color: palette.mutedText }]}>
                  {formatPeso(lot.costPerUnit)} per {lot.unit}
                </Text>
              </View>

              {lot.notes ? <Text style={[styles.body, { color: palette.mutedText }]}>{lot.notes}</Text> : null}
            </View>
          );
        })}
      </Card>
    </ScreenScroll>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
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

type UnitPickerProps = {
  selected: IngredientUnit;
  onSelect: (unit: IngredientUnit) => void;
  disabled?: boolean;
};

function UnitPicker({ selected, onSelect, disabled = false }: UnitPickerProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>Unit</Text>
      <View style={styles.unitWrap}>
        {ingredientUnits.map((unit) => {
          const isSelected = unit === selected;
          return (
            <Pressable
              disabled={disabled}
              key={unit}
              onPress={() => onSelect(unit)}
              style={[
                styles.unitOption,
                {
                  backgroundColor: isSelected ? palette.primary : palette.background,
                  borderColor: isSelected ? palette.primary : palette.border,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.unitText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{unit}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
  },
  helper: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
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
  twoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  unitWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  unitOption: {
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 52,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  unitText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  costPreview: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  saveButtonText: {
    ...typography.button,
  },
  filterInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lotRow: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 12,
  },
  lotHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  lotText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    ...typography.button,
  },
  lotMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  lotMeta: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
});
