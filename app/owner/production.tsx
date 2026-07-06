import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { planProduction } from "@/domain/productionMath";
import { loadGroceryPoolSnapshot, type GroceryPoolSnapshot } from "@/services/groceryPool";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { formatShortfallMessage, recordProduction, type ProductionResult } from "@/services/production";
import { buildCostingLines, loadRecipesOverview, type RecipesOverview } from "@/services/recipes";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, getUserSafeErrorMessage, logDevError } from "@/utils/errors";
import { numbersOnlyMessage, parseRequiredNumber } from "@/utils/numberInput";

function formatQuantity(value: number) {
  return value.toLocaleString("en-PH", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

export default function OwnerProductionScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [overview, setOverview] = useState<RecipesOverview | null>(null);
  const [grocery, setGrocery] = useState<GroceryPoolSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [lastResult, setLastResult] = useState<ProductionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextStatus = await loadOwnerSetupStatus();
    const nextOverview = await loadRecipesOverview();
    const nextGrocery = await loadGroceryPoolSnapshot();
    setStatus(nextStatus);
    setOverview(nextOverview);
    setGrocery(nextGrocery);
    setSelectedBranchId((current) => current ?? nextStatus.activeBranch?.id ?? nextStatus.branches[0]?.id ?? null);
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
          logDevError("OwnerProduction.refresh", error);
          if (active) {
            setLoadError(getFriendlyErrorMessage("Could not load production data."));
          }
        });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const branches = status?.branches ?? [];
  // Production is for prepared-before-selling recipes; cook-upon-order items
  // are costed automatically at sale time and never hold finished stock.
  const activeRecipes = useMemo(
    () =>
      (overview?.items ?? []).filter(
        (item) => item.recipe.isActive && item.lines.length > 0 && item.recipe.productionMode === "prepared_before_selling",
      ),
    [overview?.items],
  );
  const cookOnlyRecipes = useMemo(
    () =>
      (overview?.items ?? []).some(
        (item) => item.recipe.isActive && item.lines.length > 0 && item.recipe.productionMode === "cook_upon_order",
      ),
    [overview?.items],
  );
  const selectedItem = activeRecipes.find((item) => item.recipe.id === selectedRecipeId) ?? null;

  const lotMap = useMemo(
    () => new Map((grocery?.lots ?? []).map((lot) => [lot.id, lot])),
    [grocery?.lots],
  );

  const parsedQuantity = parseRequiredNumber(quantity, 0);

  const plan = useMemo(() => {
    if (!selectedItem || parsedQuantity === "invalid" || parsedQuantity <= 0) {
      return null;
    }

    const costingLines = buildCostingLines(selectedItem.lines, lotMap);
    return planProduction(costingLines, selectedItem.recipe.outputQuantity, parsedQuantity);
  }, [selectedItem, parsedQuantity, lotMap]);

  async function saveProduction() {
    if (saveLock.current) {
      return;
    }

    if (!selectedBranchId) {
      setMessage("Piliin kung saang stall ang production.");
      setMessageIsError(true);
      return;
    }

    if (!selectedItem) {
      setMessage("Piliin ang recipe na niluto.");
      setMessageIsError(true);
      return;
    }

    if (parsedQuantity === "invalid") {
      setMessage(numbersOnlyMessage);
      setMessageIsError(true);
      return;
    }

    if (parsedQuantity <= 0) {
      setMessage("Ilagay kung ilang piraso ang na-produce. Example: 12.");
      setMessageIsError(true);
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const result = await recordProduction({
        recipeId: selectedItem.recipe.id,
        branchId: selectedBranchId,
        producedQuantity: parsedQuantity,
        notes: notes.trim() || null,
      });

      setQuantity("");
      setNotes("");
      setLastResult(result);
      setMessage(
        `Saved locally on this device. ${formatQuantity(result.producedQuantity)} ${selectedItem.recipe.outputUnit} ng ${result.productName} para sa ${result.branchName}.`,
      );
      setMessageIsError(false);

      try {
        await refresh();
      } catch (refreshError) {
        logDevError("OwnerProduction.refreshAfterSave", refreshError);
        setLoadError(getFriendlyErrorMessage("Could not reload production data. Balikan ang screen na ito."));
      }
    } catch (error) {
      logDevError("OwnerProduction.saveProduction", error);
      setMessage(getUserSafeErrorMessage(error, "Could not save the production."));
      setMessageIsError(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const hasBusiness = Boolean(status?.activeBusiness);
  const saveDisabled = saving || !hasBusiness || !selectedItem || !selectedBranchId || !plan || !plan.ok;

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Niluto gamit ang recipe — automatic ang ingredients at cost." title="Niluto" />

      {loadError ? <Text style={[styles.body, { color: palette.danger }]}>{loadError}</Text> : null}

      {!hasBusiness && status ? (
        <Card>
          <Text style={[styles.body, { color: palette.warning }]}>Create your business profile in Owner Settings first.</Text>
        </Card>
      ) : null}

      {hasBusiness && branches.length === 0 ? (
        <Card>
          <Text style={[styles.body, { color: palette.warning }]}>Add a store or stall in Owner Settings first.</Text>
          <SecondaryButton href="/owner/settings" label="Open Owner Settings" />
        </Card>
      ) : null}

      {overview && hasBusiness && activeRecipes.length === 0 ? (
        <Card>
          <EmptyState
            description={
              cookOnlyRecipes
                ? "Ang mga cook-upon-order na recipe ay awtomatikong kinukuwenta sa Kiosk sale — hindi na kailangang i-produce dito."
                : "Example: Sushi, cookies, brownies."
            }
            title={
              cookOnlyRecipes
                ? "Walang prepared-before-selling na recipe."
                : "Create a recipe first before recording production."
            }
          />
          <SecondaryButton href="/owner/recipes" label="Open Recipes" />
        </Card>
      ) : null}

      {activeRecipes.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Record production</Text>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Stall</Text>
            <View style={styles.optionWrap}>
              {branches.map((branch) => {
                const isSelected = branch.id === selectedBranchId;
                return (
                  <Pressable
                    disabled={saving}
                    key={branch.id}
                    onPress={() => setSelectedBranchId(branch.id)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected ? palette.primary : palette.background,
                        borderColor: isSelected ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>
                      {branch.branchName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Recipe</Text>
            <View style={styles.optionWrap}>
              {activeRecipes.map((item) => {
                const isSelected = item.recipe.id === selectedRecipeId;
                return (
                  <Pressable
                    disabled={saving}
                    key={item.recipe.id}
                    onPress={() => setSelectedRecipeId(item.recipe.id)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected ? palette.primary : palette.background,
                        borderColor: isSelected ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>
                      {item.recipe.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {selectedItem ? (
            <View style={[styles.recipeInfo, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.itemTitle, { color: palette.text }]}>
                {selectedItem.recipe.outputProductName} · {formatQuantity(selectedItem.recipe.outputQuantity)}{" "}
                {selectedItem.recipe.outputUnit} per batch
              </Text>
              <Text style={[styles.helper, { color: palette.mutedText }]}>
                {formatPeso(selectedItem.costPerOutputUnit)} per {selectedItem.recipe.outputUnit}
                {selectedItem.makeable.stockLimited
                  ? ` · Makeable: ${formatQuantity(selectedItem.makeable.units ?? 0)} ${selectedItem.recipe.outputUnit}`
                  : ""}
              </Text>
              {selectedItem.makeable.stockLimited && selectedItem.makeable.bottleneckLabel ? (
                <Text style={[styles.helper, { color: palette.mutedText }]}>
                  Bottleneck: {selectedItem.makeable.bottleneckLabel}
                </Text>
              ) : null}
            </View>
          ) : null}

          <FormField
            editable={!saving}
            keyboardType="decimal-pad"
            label={`Quantity produced${selectedItem ? ` (${selectedItem.recipe.outputUnit})` : ""}`}
            onChangeText={setQuantity}
            placeholder="Example: 12"
            value={quantity}
          />
          {parsedQuantity === "invalid" ? (
            <Text style={[styles.body, { color: palette.danger }]}>{numbersOnlyMessage}</Text>
          ) : null}

          {plan && selectedItem ? (
            <View style={[styles.previewCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.fieldLabel, { color: palette.text }]}>Preview</Text>
              {plan.lines.map((line, index) => (
                <Text key={`${line.label}_${index}`} style={[styles.helper, { color: palette.mutedText }]}>
                  {line.label}: {line.isCustom ? "custom cost" : `${formatQuantity(line.requiredQuantity)} ${line.unit}`} ·{" "}
                  {formatPeso(line.lineCost)}
                </Text>
              ))}

              {plan.shortfalls.map((shortfall) => (
                <Text key={shortfall.lotId} style={[styles.body, { color: palette.danger }]}>
                  {formatShortfallMessage(shortfall)}
                </Text>
              ))}
              {plan.incompatibleLabels.map((label) => (
                <Text key={label} style={[styles.body, { color: palette.danger }]}>
                  {label}: hindi ma-convert ang units. I-check ang recipe at grocery units.
                </Text>
              ))}

              {plan.hasCustomLines ? (
                <Text style={[styles.helper, { color: palette.mutedText }]}>
                  Custom cost included but not deducted from grocery stock.
                </Text>
              ) : null}

              <Text style={[styles.costPreview, { color: palette.primary }]}>
                Total cost: {formatPeso(plan.totalCost)} · {formatPeso(plan.costPerOutputUnit)} per{" "}
                {selectedItem.recipe.outputUnit}
              </Text>
              <Text style={[styles.helper, { color: palette.success }]}>
                Stock ng {selectedItem.recipe.outputProductName} will increase by {formatQuantity(parsedQuantity === "invalid" ? 0 : parsedQuantity)}.
              </Text>
            </View>
          ) : null}

          <FormField
            editable={!saving}
            label="Notes (optional)"
            onChangeText={setNotes}
            placeholder="Example: umagang luto"
            value={notes}
          />

          {message ? (
            <Text style={[styles.body, { color: messageIsError ? palette.danger : palette.success }]}>{message}</Text>
          ) : null}

          <Pressable
            disabled={saveDisabled}
            onPress={saveProduction}
            style={[styles.saveButton, { backgroundColor: palette.primary, opacity: saveDisabled ? 0.6 : 1 }]}
          >
            <Text style={[styles.saveButtonText, { color: palette.kioskHeaderText }]}>
              {saving ? "Saving..." : "Save Niluto"}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {lastResult ? (
        <Card>
          <View style={styles.resultHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Latest production</Text>
            <Pill label="Saved" tone="success" />
          </View>
          <Text style={[styles.body, { color: palette.text }]}>
            {lastResult.recipeName} → {formatQuantity(lastResult.producedQuantity)} {lastResult.productName} @{" "}
            {lastResult.branchName}
          </Text>
          <Text style={[styles.helper, { color: palette.mutedText }]}>
            Cost: {formatPeso(lastResult.totalCost)} · {formatPeso(lastResult.costPerOutputUnit)} each · Stock is now{" "}
            {formatQuantity(lastResult.newStockQty)}
          </Text>
        </Card>
      ) : null}
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

const styles = StyleSheet.create({
  body: {
    ...typography.body,
  },
  helper: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  sectionTitle: {
    ...typography.heading,
  },
  field: {
    gap: spacing.xs,
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
  recipeInfo: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: 12,
  },
  itemTitle: {
    ...typography.button,
  },
  previewCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: 12,
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
  resultHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
});
