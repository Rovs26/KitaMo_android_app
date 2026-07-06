import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, formatQuantity, MetricCard, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { ingredientUnits } from "@/db/repositories";
import type { IngredientUnit, Product, RecipeProductionMode } from "@/domain/types";
import { loadGroceryPoolSnapshot, type GroceryPoolSnapshot } from "@/services/groceryPool";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import {
  archiveRecipe,
  createRecipeWithLines,
  loadRecipesOverview,
  previewDraftLineCost,
  type RecipeDraftLine,
  type RecipesOverview,
} from "@/services/recipes";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, getUserSafeErrorMessage, logDevError } from "@/utils/errors";
import { numbersOnlyMessage, parseRequiredNumber } from "@/utils/numberInput";

type DraftLineView = {
  key: string;
  kind: "lot" | "custom";
  label: string;
  detail: string;
  lineCost: number;
  lotId: string | null;
  customName: string | null;
  quantity: number;
  unit: IngredientUnit;
};

const productionModes: { id: RecipeProductionMode; label: string }[] = [
  { id: "prepared_before_selling", label: "Prepared before selling" },
  { id: "cook_upon_order", label: "Cook upon order" },
];

export default function OwnerRecipesScreen() {
  const [overview, setOverview] = useState<RecipesOverview | null>(null);
  const [grocery, setGrocery] = useState<GroceryPoolSnapshot | null>(null);
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [outputProductId, setOutputProductId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [outputQuantity, setOutputQuantity] = useState("");
  const [outputUnit, setOutputUnit] = useState<IngredientUnit>("pcs");
  const [productionMode, setProductionMode] = useState<RecipeProductionMode>("prepared_before_selling");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLineView[]>([]);

  const [lotSearch, setLotSearch] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [lineQuantity, setLineQuantity] = useState("");
  const [lineUnit, setLineUnit] = useState<IngredientUnit>("g");
  const [lineMessage, setLineMessage] = useState<string | null>(null);

  const [customName, setCustomName] = useState("");
  const [customCost, setCustomCost] = useState("");

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formIsError, setFormIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const archiveLock = useRef(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const draftKeyRef = useRef(0);

  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextStatus = await loadOwnerSetupStatus();
    const nextOverview = await loadRecipesOverview();
    const nextGrocery = await loadGroceryPoolSnapshot();
    setStatus(nextStatus);
    setOverview(nextOverview);
    setGrocery(nextGrocery);
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
          logDevError("OwnerRecipes.refresh", error);
          if (active) {
            setLoadError(getFriendlyErrorMessage("Could not load recipes."));
          }
        });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const products = status?.products ?? [];
  const lots = useMemo(() => (grocery?.lots ?? []).filter((lot) => lot.status !== "archived"), [grocery?.lots]);

  const matchingLots = useMemo(() => {
    const query = lotSearch.trim().toLowerCase();
    if (!query) {
      return lots.slice(0, 6);
    }

    return lots
      .filter((lot) =>
        [lot.ingredientName, lot.brandName ?? "", lot.sourceName ?? ""].some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, 6);
  }, [lots, lotSearch]);

  const selectedLot = useMemo(() => lots.find((lot) => lot.id === selectedLotId) ?? null, [lots, selectedLotId]);

  const linePreview = useMemo(() => {
    if (!selectedLot) {
      return null;
    }

    const quantity = parseRequiredNumber(lineQuantity, 0);
    if (quantity === "invalid" || quantity <= 0) {
      return null;
    }

    const result = previewDraftLineCost({ quantity, unit: lineUnit, lot: selectedLot });
    if (!result.ok) {
      return { incompatible: true as const, lineCost: 0 };
    }

    return { incompatible: false as const, lineCost: result.lineCost };
  }, [selectedLot, lineQuantity, lineUnit]);

  const batchCostPreview = draftLines.reduce((total, line) => total + line.lineCost, 0);
  const outputQuantityParsed = parseRequiredNumber(outputQuantity, 0);
  const costPerUnitPreview =
    outputQuantityParsed !== "invalid" && outputQuantityParsed > 0 ? batchCostPreview / outputQuantityParsed : null;

  function nextDraftKey() {
    draftKeyRef.current += 1;
    return `draft_${draftKeyRef.current}`;
  }

  function addLotLine() {
    setLineMessage(null);

    if (!selectedLot) {
      setLineMessage("Piliin muna ang grocery item para sa linya.");
      return;
    }

    const quantity = parseRequiredNumber(lineQuantity, 0);
    if (quantity === "invalid") {
      setLineMessage(numbersOnlyMessage);
      return;
    }

    if (quantity <= 0) {
      setLineMessage("Ilagay kung gaano karami ang gamit sa recipe. Example: 100.");
      return;
    }

    const preview = previewDraftLineCost({ quantity, unit: lineUnit, lot: selectedLot });
    if (!preview.ok) {
      setLineMessage(
        preview.incompatible
          ? `Hindi ma-convert ang ${lineUnit} papunta sa ${selectedLot.unit}. Gamitin ang ${selectedLot.unit}, o katugmang g/kg o ml/L.`
          : "Walang cost na mababasa para sa grocery item na ito.",
      );
      return;
    }

    const brand = selectedLot.brandName?.trim();
    const source = selectedLot.sourceName?.trim();

    setDraftLines((current) => [
      ...current,
      {
        key: nextDraftKey(),
        kind: "lot",
        label: brand ? `${selectedLot.ingredientName} · ${brand}` : selectedLot.ingredientName,
        detail: `${formatQuantity(quantity)} ${lineUnit}${source ? ` · ${source}` : ""}`,
        lineCost: preview.lineCost,
        lotId: selectedLot.id,
        customName: null,
        quantity,
        unit: lineUnit,
      },
    ]);
    setSelectedLotId(null);
    setLotSearch("");
    setLineQuantity("");
  }

  function addCustomLine() {
    setLineMessage(null);

    const name = customName.trim();
    if (!name) {
      setLineMessage("Ilagay ang pangalan ng custom ingredient.");
      return;
    }

    const cost = parseRequiredNumber(customCost, 0);
    if (cost === "invalid") {
      setLineMessage(numbersOnlyMessage);
      return;
    }

    if (cost <= 0) {
      setLineMessage("Ilagay ang custom cost. Example: 15.");
      return;
    }

    setDraftLines((current) => [
      ...current,
      {
        key: nextDraftKey(),
        kind: "custom",
        label: name,
        detail: "Custom cost",
        lineCost: cost,
        lotId: null,
        customName: name,
        quantity: 0,
        unit: "pcs",
      },
    ]);
    setCustomName("");
    setCustomCost("");
  }

  function removeDraftLine(key: string) {
    setDraftLines((current) => current.filter((line) => line.key !== key));
  }

  function resetForm() {
    setOutputProductId(null);
    setRecipeName("");
    setOutputQuantity("");
    setOutputUnit("pcs");
    setProductionMode("prepared_before_selling");
    setRecipeNotes("");
    setDraftLines([]);
    setSelectedLotId(null);
    setLotSearch("");
    setLineQuantity("");
    setCustomName("");
    setCustomCost("");
    setLineMessage(null);
  }

  async function saveRecipe() {
    if (saveLock.current) {
      return;
    }

    if (!outputProductId) {
      setFormMessage("Piliin kung anong paninda ang gawa ng recipe na ito.");
      setFormIsError(true);
      return;
    }

    const name = recipeName.trim();
    if (!name) {
      setFormMessage("Recipe name is required. Example: Sushi.");
      setFormIsError(true);
      return;
    }

    const output = parseRequiredNumber(outputQuantity, 0);
    if (output === "invalid") {
      setFormMessage(numbersOnlyMessage);
      setFormIsError(true);
      return;
    }

    if (output <= 0) {
      setFormMessage("Ilagay kung ilang piraso ang gawa ng isang batch. Example: 5.");
      setFormIsError(true);
      return;
    }

    if (draftLines.length === 0) {
      setFormMessage("Add at least one ingredient line.");
      setFormIsError(true);
      return;
    }

    const lines: RecipeDraftLine[] = draftLines.map((line) =>
      line.kind === "lot"
        ? { kind: "lot", lotId: line.lotId as string, quantity: line.quantity, unit: line.unit }
        : { kind: "custom", name: line.customName as string, cost: line.lineCost },
    );

    saveLock.current = true;
    setSaving(true);
    setFormMessage(null);
    try {
      const result = await createRecipeWithLines({
        outputProductId,
        name,
        outputQuantity: output,
        outputUnit,
        productionMode,
        notes: recipeNotes.trim() || null,
        lines,
      });

      resetForm();
      setFormMessage(
        `Saved locally on this device. ${result.recipe.name}: ${formatPeso(result.batchCost)} per batch, ${formatPeso(result.costPerOutputUnit)} per ${outputUnit}.`,
      );
      setFormIsError(false);

      try {
        await refresh();
      } catch (refreshError) {
        logDevError("OwnerRecipes.refreshAfterSave", refreshError);
        setLoadError(getFriendlyErrorMessage("Could not reload the recipe list. Balikan ang screen na ito."));
      }
    } catch (error) {
      logDevError("OwnerRecipes.saveRecipe", error);
      setFormMessage(getUserSafeErrorMessage(error, "Could not save the recipe."));
      setFormIsError(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function archive(recipeId: string) {
    if (archiveLock.current) {
      return;
    }

    archiveLock.current = true;
    setArchivingId(recipeId);
    try {
      await archiveRecipe(recipeId);
      await refresh();
    } catch (error) {
      logDevError("OwnerRecipes.archive", error);
      setLoadError(getFriendlyErrorMessage("Could not archive the recipe."));
    } finally {
      archiveLock.current = false;
      setArchivingId(null);
    }
  }

  const visibleItems = (overview?.items ?? []).filter((item) => item.recipe.isActive);
  const hasBusiness = Boolean(status?.activeBusiness);

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Gumawa ng recipe at tingnan ang cost per paninda." title="Recipe Cost" />

      {loadError ? <Text style={[styles.body, { color: palette.danger }]}>{loadError}</Text> : null}

      <SecondaryButton href="/owner/production" label="Record production gamit ang recipe" />

      <View style={styles.metricGrid}>
        <MetricCard detail="Saved recipes" icon="R" label="Active" tone="primary" value={String(overview?.activeCount ?? 0)} />
        <MetricCard
          detail="Per output unit"
          icon="₱"
          label="Avg cost"
          tone="success"
          value={overview?.averageCostPerUnit !== null && overview?.averageCostPerUnit !== undefined ? formatPeso(overview.averageCostPerUnit) : "—"}
        />
        <MetricCard
          detail="Konti na ang stock"
          icon="!"
          label="Low makeable"
          tone={(overview?.lowMakeableCount ?? 0) > 0 ? "warning" : "success"}
          value={String(overview?.lowMakeableCount ?? 0)}
        />
        <MetricCard detail="With custom cost" icon="C" label="Custom" tone="accent" value={String(overview?.customCostCount ?? 0)} />
      </View>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>My recipes</Text>

        {overview && visibleItems.length === 0 ? (
          <EmptyState description="Example: Sushi, cookies, brownies." title="Create your first recipe." />
        ) : null}

        {visibleItems.map((item) => (
          <View key={item.recipe.id} style={[styles.recipeCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <View style={styles.recipeHeader}>
              <View style={styles.recipeText}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>{item.recipe.name}</Text>
                <Text style={[styles.helper, { color: palette.mutedText }]}>
                  {item.recipe.outputProductName} · makes {formatQuantity(item.recipe.outputQuantity)} {item.recipe.outputUnit}
                </Text>
              </View>
              <Pill
                label={item.recipe.productionMode === "cook_upon_order" ? "Cook upon order" : "Prepared before selling"}
                tone={item.recipe.productionMode === "cook_upon_order" ? "accent" : "primary"}
              />
            </View>

            <View style={styles.recipeMetaGrid}>
              <Text style={[styles.recipeMeta, { color: palette.primary }]}>{formatPeso(item.batchCost)} per batch</Text>
              <Text style={[styles.recipeMeta, { color: palette.text }]}>
                {formatPeso(item.costPerOutputUnit)} per {item.recipe.outputUnit}
              </Text>
            </View>

            {item.makeable.stockLimited ? (
              <View style={styles.makeableRow}>
                <Pill
                  label={`Makeable: ${formatQuantity(item.makeable.units ?? 0)} ${item.recipe.outputUnit}`}
                  tone={(item.makeable.batches ?? 0) <= 1 ? "warning" : "success"}
                />
                {item.makeable.bottleneckLabel && (item.makeable.batches ?? 0) >= 0 ? (
                  <Text style={[styles.helper, { color: palette.mutedText }]}>Bottleneck: {item.makeable.bottleneckLabel}</Text>
                ) : null}
              </View>
            ) : null}

            {item.hasCustomLines ? (
              <Text style={[styles.helper, { color: palette.mutedText }]}>
                Custom cost lines are included in cost but not checked against stock yet.
              </Text>
            ) : null}

            <View style={styles.lineList}>
              {item.lines.map((line) => (
                <Text key={line.id} style={[styles.helper, { color: palette.mutedText }]}>
                  {line.sourceLabelSnapshot ?? line.customName ?? "Ingredient"}
                  {line.isCustom ? "" : ` · ${formatQuantity(line.quantity)} ${line.unit}`} · {formatPeso(line.lineCostSnapshot)}
                </Text>
              ))}
            </View>

            <Pressable
              disabled={archivingId !== null}
              onPress={() => archive(item.recipe.id)}
              style={[styles.smallButton, { borderColor: palette.border, opacity: archivingId !== null ? 0.55 : 1 }]}
            >
              <Text style={[styles.smallButtonText, { color: palette.primary }]}>
                {archivingId === item.recipe.id ? "Archiving..." : "Archive"}
              </Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Create Recipe</Text>

        {!hasBusiness && status ? (
          <Text style={[styles.body, { color: palette.warning }]}>Create your business profile in Owner Settings first.</Text>
        ) : null}

        {hasBusiness && products.length === 0 ? (
          <>
            <Text style={[styles.body, { color: palette.warning }]}>Add your paninda first para may output ang recipe.</Text>
            <SecondaryButton href="/owner/inventory" label="Open Owner Inventory" />
          </>
        ) : null}

        <ProductPicker
          disabled={saving}
          onSelect={(product) => {
            setOutputProductId(product.id);
            if (!recipeName.trim()) {
              setRecipeName(product.name);
            }
          }}
          products={products}
          selectedId={outputProductId}
        />

        <FormField
          editable={!saving}
          label="Recipe name"
          onChangeText={setRecipeName}
          placeholder="Example: Sushi"
          value={recipeName}
        />

        <View style={styles.twoColumn}>
          <FormField
            editable={!saving}
            keyboardType="decimal-pad"
            label="Output per batch"
            onChangeText={setOutputQuantity}
            placeholder="Example: 5"
            value={outputQuantity}
          />
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Output unit</Text>
            <View style={styles.optionWrap}>
              {ingredientUnits.map((unit) => {
                const isSelected = unit === outputUnit;
                return (
                  <Pressable
                    disabled={saving}
                    key={unit}
                    onPress={() => setOutputUnit(unit)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected ? palette.primary : palette.background,
                        borderColor: isSelected ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{unit}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Production mode</Text>
          <View style={styles.optionWrap}>
            {productionModes.map((mode) => {
              const isSelected = mode.id === productionMode;
              return (
                <Pressable
                  disabled={saving}
                  key={mode.id}
                  onPress={() => setProductionMode(mode.id)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: isSelected ? palette.primary : palette.background,
                      borderColor: isSelected ? palette.primary : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{mode.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.lineBuilder, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.builderTitle, { color: palette.text }]}>Add ingredient from Grocery Stock</Text>

          {lots.length === 0 ? (
            <>
              <Text style={[styles.body, { color: palette.mutedText }]}>
                Walang laman ang Grocery Stock. Add groceries muna, o gumamit ng custom cost sa baba.
              </Text>
              <SecondaryButton href="/owner/grocery" label="Open Grocery Stock" />
            </>
          ) : (
            <>
              <TextInput
                editable={!saving}
                onChangeText={(value) => {
                  setLotSearch(value);
                  setSelectedLotId(null);
                }}
                placeholder="Search ingredient, brand, o source"
                placeholderTextColor={palette.mutedText}
                style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
                value={lotSearch}
              />

              {matchingLots.length === 0 ? (
                <Text style={[styles.helper, { color: palette.mutedText }]}>Walang tugma sa Grocery Stock.</Text>
              ) : null}

              {matchingLots.map((lot) => {
                const isSelected = lot.id === selectedLotId;
                return (
                  <Pressable
                    disabled={saving}
                    key={lot.id}
                    onPress={() => setSelectedLotId(lot.id)}
                    style={[
                      styles.lotOption,
                      {
                        backgroundColor: isSelected ? palette.softPrimary : palette.surface,
                        borderColor: isSelected ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <View style={styles.lotOptionText}>
                      <Text style={[styles.itemTitle, { color: palette.text }]}>
                        {lot.ingredientName}
                        {lot.brandName ? ` · ${lot.brandName}` : ""}
                      </Text>
                      <Text style={[styles.helper, { color: palette.mutedText }]}>
                        {lot.sourceName ? `${lot.sourceName} · ` : ""}
                        {formatQuantity(lot.remainingQuantity)} {lot.unit} left · {formatPeso(lot.costPerUnit)} per {lot.unit}
                      </Text>
                    </View>
                    {isSelected ? <Pill label="Selected" tone="primary" /> : null}
                  </Pressable>
                );
              })}

              <View style={styles.twoColumn}>
                <FormField
                  editable={!saving}
                  keyboardType="decimal-pad"
                  label="Quantity used"
                  onChangeText={setLineQuantity}
                  placeholder="Example: 100"
                  value={lineQuantity}
                />
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: palette.text }]}>Unit</Text>
                  <View style={styles.optionWrap}>
                    {ingredientUnits.map((unit) => {
                      const isSelected = unit === lineUnit;
                      return (
                        <Pressable
                          disabled={saving}
                          key={unit}
                          onPress={() => setLineUnit(unit)}
                          style={[
                            styles.option,
                            {
                              backgroundColor: isSelected ? palette.primary : palette.background,
                              borderColor: isSelected ? palette.primary : palette.border,
                            },
                          ]}
                        >
                          <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{unit}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              {linePreview && !linePreview.incompatible ? (
                <Text style={[styles.costPreview, { color: palette.primary }]}>Line cost: {formatPeso(linePreview.lineCost)}</Text>
              ) : null}
              {linePreview?.incompatible && selectedLot ? (
                <Text style={[styles.body, { color: palette.danger }]}>
                  Hindi ma-convert ang {lineUnit} papunta sa {selectedLot.unit}. Gamitin ang {selectedLot.unit}, o katugmang g/kg o ml/L.
                </Text>
              ) : null}

              <Pressable
                disabled={saving}
                onPress={addLotLine}
                style={[styles.smallButton, { borderColor: palette.border, opacity: saving ? 0.55 : 1 }]}
              >
                <Text style={[styles.smallButtonText, { color: palette.primary }]}>Add ingredient line</Text>
              </Pressable>
            </>
          )}

          <Text style={[styles.builderTitle, { color: palette.text }]}>O custom cost kung wala sa pool</Text>
          <View style={styles.twoColumn}>
            <FormField
              editable={!saving}
              label="Custom ingredient"
              onChangeText={setCustomName}
              placeholder="Example: Nori"
              value={customName}
            />
            <FormField
              editable={!saving}
              keyboardType="decimal-pad"
              label="Cost"
              onChangeText={setCustomCost}
              placeholder="Example: 15"
              value={customCost}
            />
          </View>
          <Text style={[styles.helper, { color: palette.mutedText }]}>
            Custom cost is included in recipe cost but will not deduct grocery stock yet.
          </Text>
          <Pressable
            disabled={saving}
            onPress={addCustomLine}
            style={[styles.smallButton, { borderColor: palette.border, opacity: saving ? 0.55 : 1 }]}
          >
            <Text style={[styles.smallButtonText, { color: palette.primary }]}>Add custom line</Text>
          </Pressable>

          {lineMessage ? <Text style={[styles.body, { color: palette.danger }]}>{lineMessage}</Text> : null}
        </View>

        {draftLines.length > 0 ? (
          <View style={styles.draftList}>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Ingredient lines</Text>
            {draftLines.map((line) => (
              <View key={line.key} style={[styles.draftRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <View style={styles.draftText}>
                  <Text style={[styles.itemTitle, { color: palette.text }]}>{line.label}</Text>
                  <Text style={[styles.helper, { color: palette.mutedText }]}>
                    {line.detail} · {formatPeso(line.lineCost)}
                  </Text>
                </View>
                <Pressable disabled={saving} onPress={() => removeDraftLine(line.key)}>
                  <Text style={[styles.removeText, { color: palette.danger }]}>Remove</Text>
                </Pressable>
              </View>
            ))}

            <Text style={[styles.costPreview, { color: palette.primary }]}>
              Batch cost: {formatPeso(batchCostPreview)}
              {costPerUnitPreview !== null ? ` · ${formatPeso(costPerUnitPreview)} per ${outputUnit}` : ""}
            </Text>
          </View>
        ) : null}

        <FormField
          editable={!saving}
          label="Notes (optional)"
          onChangeText={setRecipeNotes}
          placeholder="Example: pang-umaga na batch"
          value={recipeNotes}
        />

        {formMessage ? (
          <Text style={[styles.body, { color: formIsError ? palette.danger : palette.success }]}>{formMessage}</Text>
        ) : null}

        <Pressable
          disabled={saving || !hasBusiness || products.length === 0}
          onPress={saveRecipe}
          style={[
            styles.saveButton,
            { backgroundColor: palette.primary, opacity: saving || !hasBusiness || products.length === 0 ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.saveButtonText, { color: palette.kioskHeaderText }]}>{saving ? "Saving..." : "Save Recipe"}</Text>
        </Pressable>
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

type ProductPickerProps = {
  products: Product[];
  selectedId: string | null;
  onSelect: (product: Product) => void;
  disabled?: boolean;
};

function ProductPicker({ products, selectedId, onSelect, disabled = false }: ProductPickerProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  if (products.length === 0) {
    return null;
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>Output paninda</Text>
      <View style={styles.optionWrap}>
        {products.map((product) => {
          const isSelected = product.id === selectedId;
          return (
            <Pressable
              disabled={disabled}
              key={product.id}
              onPress={() => onSelect(product)}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? palette.primary : palette.background,
                  borderColor: isSelected ? palette.primary : palette.border,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{product.name}</Text>
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
  recipeCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 12,
  },
  recipeHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  recipeText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    ...typography.button,
  },
  recipeMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  recipeMeta: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  makeableRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  lineList: {
    gap: spacing.xs,
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
  lineBuilder: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 12,
  },
  builderTitle: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  lotOption: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: 10,
  },
  lotOptionText: {
    flex: 1,
    gap: 2,
  },
  costPreview: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  smallButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  draftList: {
    gap: spacing.sm,
  },
  draftRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: 10,
  },
  draftText: {
    flex: 1,
    gap: 2,
  },
  removeText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
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
});
