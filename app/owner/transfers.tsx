import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, formatQuantity, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { listTransferableProducts, recordTransfer, type TransferableProduct, type TransferResult } from "@/services/transfers";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, getUserSafeErrorMessage, logDevError } from "@/utils/errors";
import { numbersOnlyMessage, parseRequiredNumber } from "@/utils/numberInput";

export default function OwnerTransfersScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [products, setProducts] = useState<TransferableProduct[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [toBranchId, setToBranchId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [lastResult, setLastResult] = useState<TransferResult | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextStatus = await loadOwnerSetupStatus();
    const nextProducts = await listTransferableProducts();
    setStatus(nextStatus);
    setProducts(nextProducts);
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
          logDevError("OwnerTransfers.refresh", error);
          if (active) {
            setLoadError(getFriendlyErrorMessage("Could not load transfers."));
          }
        });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const branches = useMemo(() => status?.branches ?? [], [status?.branches]);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const destinationBranches = useMemo(
    () => branches.filter((branch) => branch.id !== selectedProduct?.branchId),
    [branches, selectedProduct?.branchId],
  );

  const parsedQuantity = parseRequiredNumber(quantity, 0);

  async function saveTransfer() {
    if (saveLock.current) {
      return;
    }

    if (!selectedProduct) {
      setMessage("Piliin ang product na ililipat.");
      setMessageIsError(true);
      return;
    }

    if (!toBranchId) {
      setMessage("Piliin kung saang stall ililipat.");
      setMessageIsError(true);
      return;
    }

    if (parsedQuantity === "invalid") {
      setMessage(numbersOnlyMessage);
      setMessageIsError(true);
      return;
    }

    if (parsedQuantity <= 0) {
      setMessage("Ilagay kung ilang piraso ang ililipat. Example: 5.");
      setMessageIsError(true);
      return;
    }

    if (parsedQuantity > selectedProduct.stockQty) {
      setMessage(`Hindi puwedeng mas mataas sa current stock (${formatQuantity(selectedProduct.stockQty)} ${selectedProduct.unitType}).`);
      setMessageIsError(true);
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const result = await recordTransfer({
        productId: selectedProduct.id,
        toBranchId,
        quantity: parsedQuantity,
        notes: notes.trim() || null,
      });

      setQuantity("");
      setNotes("");
      setSelectedProductId(null);
      setToBranchId(null);
      setLastResult(result);
      setMessage(
        `Saved locally on this device. ${formatQuantity(result.quantity)} ${result.productName} inilipat sa ${result.toBranchName}.`,
      );
      setMessageIsError(false);

      try {
        await refresh();
      } catch (refreshError) {
        logDevError("OwnerTransfers.refreshAfterSave", refreshError);
        setLoadError(getFriendlyErrorMessage("Could not reload transfers. Balikan ang screen na ito."));
      }
    } catch (error) {
      logDevError("OwnerTransfers.saveTransfer", error);
      setMessage(getUserSafeErrorMessage(error, "Could not save the transfer."));
      setMessageIsError(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const hasBusiness = Boolean(status?.activeBusiness);
  const enoughBranches = branches.length >= 2;

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Ilipat ang paninda sa ibang stall — sama ang halaga." title="Transfers" />

      {loadError ? <Text style={[styles.body, { color: palette.danger }]}>{loadError}</Text> : null}

      {!hasBusiness && status ? (
        <Card>
          <Text style={[styles.body, { color: palette.warning }]}>Create your business profile in Owner Settings first.</Text>
        </Card>
      ) : null}

      {hasBusiness && !enoughBranches ? (
        <Card>
          <EmptyState description="Kailangan ng at least dalawang stall para makapag-lipat." title="Add another stall first" />
          <SecondaryButton href="/owner/settings" label="Open Owner Settings" />
        </Card>
      ) : null}

      {hasBusiness && enoughBranches && products.length === 0 && status ? (
        <Card>
          <EmptyState description="Products with stock na naka-assign sa isang stall ang puwedeng ilipat." title="Walang product na puwedeng ilipat." />
        </Card>
      ) : null}

      {products.length > 0 && enoughBranches ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Ilipat ang paninda</Text>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Product</Text>
            <View style={styles.optionWrap}>
              {products.map((product) => {
                const isSelected = product.id === selectedProductId;
                return (
                  <Pressable
                    disabled={saving}
                    key={product.id}
                    onPress={() => {
                      setSelectedProductId(product.id);
                      setToBranchId(null);
                    }}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected ? palette.primary : palette.background,
                        borderColor: isSelected ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>
                      {product.name} ({formatQuantity(product.stockQty)})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {selectedProduct ? (
            <>
              <Text style={[styles.helper, { color: palette.mutedText }]}>
                Galing sa {selectedProduct.branchName} · {formatQuantity(selectedProduct.stockQty)} {selectedProduct.unitType} available
              </Text>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Papunta sa</Text>
                <View style={styles.optionWrap}>
                  {destinationBranches.map((branch) => {
                    const isSelected = branch.id === toBranchId;
                    return (
                      <Pressable
                        disabled={saving}
                        key={branch.id}
                        onPress={() => setToBranchId(branch.id)}
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
            </>
          ) : null}

          <FormField
            editable={!saving}
            keyboardType="decimal-pad"
            label="Quantity"
            onChangeText={setQuantity}
            placeholder="Example: 5"
            value={quantity}
          />
          {parsedQuantity === "invalid" ? (
            <Text style={[styles.body, { color: palette.danger }]}>{numbersOnlyMessage}</Text>
          ) : null}

          <FormField
            editable={!saving}
            label="Notes (optional)"
            onChangeText={setNotes}
            placeholder="Example: pang-hapon sa booth"
            value={notes}
          />

          {message ? (
            <Text style={[styles.body, { color: messageIsError ? palette.danger : palette.success }]}>{message}</Text>
          ) : null}

          <Pressable
            disabled={saving}
            onPress={saveTransfer}
            style={[styles.saveButton, { backgroundColor: palette.primary, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={[styles.saveButtonText, { color: palette.kioskHeaderText }]}>{saving ? "Saving..." : "Save Transfer"}</Text>
          </Pressable>
        </Card>
      ) : null}

      {lastResult ? (
        <Card>
          <View style={styles.resultHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Latest transfer</Text>
            <Pill label="Saved" tone="success" />
          </View>
          <Text style={[styles.body, { color: palette.text }]}>
            {formatQuantity(lastResult.quantity)} {lastResult.productName}: {lastResult.fromBranchName} → {lastResult.toBranchName}
          </Text>
          <Text style={[styles.helper, { color: palette.mutedText }]}>
            Value moved: {formatPeso(lastResult.totalCost)} ({formatPeso(lastResult.unitCost)} each)
            {lastResult.createdDestinationProduct ? " · Gumawa ng bagong product entry sa destination stall." : ""}
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
