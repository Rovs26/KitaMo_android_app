import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, MetricCard, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { fixedCostCategories, fixedCostFrequencies } from "@/db/repositories";
import type { FixedCostCategory, FixedCostFrequencyType } from "@/domain/types";
import { isValidIsoDate } from "@/domain/fixedCostSchedule";
import {
  addFixedCost,
  archiveFixedCost,
  loadFixedCostsOverview,
  markFixedCostPaid,
  type FixedCostsOverview,
} from "@/services/fixedCosts";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, getUserSafeErrorMessage, logDevError } from "@/utils/errors";
import { numbersOnlyMessage, parseRequiredNumber } from "@/utils/numberInput";

const categoryLabels: Record<FixedCostCategory, string> = {
  rent: "Rent",
  wages: "Sweldo",
  electricity: "Kuryente",
  water: "Tubig",
  transport: "Transport",
  lpg_gas: "LPG / Gas",
  market_fee: "Market fee",
  internet_load: "Internet / Load",
  other: "Iba pa",
};

const frequencyLabels: Record<FixedCostFrequencyType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  one_time: "One-time",
};

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export default function OwnerFixedCostsScreen() {
  const [overview, setOverview] = useState<FixedCostsOverview | null>(null);
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<FixedCostCategory>("rent");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<FixedCostFrequencyType>("monthly");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formIsError, setFormIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const actionLock = useRef(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextStatus = await loadOwnerSetupStatus();
    const nextOverview = await loadFixedCostsOverview();
    setStatus(nextStatus);
    setOverview(nextOverview);
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
          logDevError("OwnerFixedCosts.refresh", error);
          if (active) {
            setLoadError(getFriendlyErrorMessage("Could not load fixed costs."));
          }
        });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  async function saveFixedCost() {
    if (saveLock.current) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormMessage("Ilagay ang pangalan ng gastos. Example: Stall rent.");
      setFormIsError(true);
      return;
    }

    const parsedAmount = parseRequiredNumber(amount, 0);
    if (parsedAmount === "invalid") {
      setFormMessage(numbersOnlyMessage);
      setFormIsError(true);
      return;
    }

    if (parsedAmount <= 0) {
      setFormMessage("Ilagay ang halaga. Example: 3000.");
      setFormIsError(true);
      return;
    }

    const trimmedDueDate = dueDate.trim();
    if (trimmedDueDate && !isValidIsoDate(trimmedDueDate)) {
      setFormMessage("Date should look like 2026-07-15. Leave it blank for today.");
      setFormIsError(true);
      return;
    }

    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    saveLock.current = true;
    setSaving(true);
    setFormMessage(null);
    try {
      const cost = await addFixedCost({
        branchId,
        name: trimmedName,
        category,
        amount: parsedAmount,
        frequency,
        dueDate: trimmedDueDate || todayIso,
        notes: notes.trim() || null,
      });

      setName("");
      setAmount("");
      setDueDate("");
      setNotes("");
      setFormMessage(`Saved locally on this device. ${cost.name}: ${formatPeso(cost.amount)} ${frequencyLabels[cost.frequency].toLowerCase()}.`);
      setFormIsError(false);

      try {
        await refresh();
      } catch (refreshError) {
        logDevError("OwnerFixedCosts.refreshAfterSave", refreshError);
        setLoadError(getFriendlyErrorMessage("Could not reload fixed costs. Balikan ang screen na ito."));
      }
    } catch (error) {
      logDevError("OwnerFixedCosts.saveFixedCost", error);
      setFormMessage(getUserSafeErrorMessage(error, "Could not save the fixed cost."));
      setFormIsError(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function runAction(costId: string, action: "pay" | "archive") {
    if (actionLock.current) {
      return;
    }

    actionLock.current = true;
    setActingId(costId);
    try {
      if (action === "pay") {
        const result = await markFixedCostPaid(costId);
        setFormMessage(`Bayad na: ${result.costName} (${formatDate(result.dueDate)}).`);
        setFormIsError(false);
      } else {
        await archiveFixedCost(costId);
        setFormMessage("Fixed cost archived. History stays saved.");
        setFormIsError(false);
      }
      await refresh();
    } catch (error) {
      logDevError("OwnerFixedCosts.runAction", error);
      setFormMessage(getUserSafeErrorMessage(error, "Could not update the fixed cost."));
      setFormIsError(true);
    } finally {
      actionLock.current = false;
      setActingId(null);
    }
  }

  const branches = status?.branches ?? [];
  const hasBusiness = Boolean(status?.activeBusiness);
  const items = overview?.items ?? [];

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Rent, sweldo, kuryente, at regular na gastos ng stall." title="Bayarin" />

      {loadError ? <Text style={[styles.body, { color: palette.danger }]}>{loadError}</Text> : null}

      <View style={styles.metricGrid}>
        <MetricCard detail="Sa susunod na 7 days" icon="D" label="Due soon" tone={(overview?.dueSoonCount ?? 0) > 0 ? "warning" : "success"} value={String(overview?.dueSoonCount ?? 0)} />
        <MetricCard detail="Lagpas na sa due date" icon="!" label="Overdue" tone={(overview?.overdueCount ?? 0) > 0 ? "danger" : "success"} value={String(overview?.overdueCount ?? 0)} />
        <MetricCard detail="Paid this month" icon="P" label="Paid" tone="success" value={formatPeso(overview?.paidThisMonthTotal ?? 0)} />
        <MetricCard detail="Total due this month" icon="₱" label="This month" tone="primary" value={formatPeso(overview?.thisMonthTotal ?? 0)} />
      </View>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Add fixed cost</Text>

        {!hasBusiness && status ? (
          <Text style={[styles.body, { color: palette.warning }]}>Create your business profile in Owner Settings first.</Text>
        ) : null}

        <FormField editable={!saving} label="Name" onChangeText={setName} placeholder="Example: Stall rent" value={name} />

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Category</Text>
          <View style={styles.optionWrap}>
            {fixedCostCategories.map((entry) => {
              const isSelected = entry === category;
              return (
                <Pressable
                  disabled={saving}
                  key={entry}
                  onPress={() => setCategory(entry)}
                  style={[styles.option, { backgroundColor: isSelected ? palette.primary : palette.background, borderColor: isSelected ? palette.primary : palette.border }]}
                >
                  <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{categoryLabels[entry]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Stall</Text>
          <View style={styles.optionWrap}>
            <Pressable
              disabled={saving}
              onPress={() => setBranchId(null)}
              style={[styles.option, { backgroundColor: branchId === null ? palette.primary : palette.background, borderColor: branchId === null ? palette.primary : palette.border }]}
            >
              <Text style={[styles.optionText, { color: branchId === null ? palette.kioskHeaderText : palette.text }]}>Buong negosyo</Text>
            </Pressable>
            {branches.map((branch) => {
              const isSelected = branch.id === branchId;
              return (
                <Pressable
                  disabled={saving}
                  key={branch.id}
                  onPress={() => setBranchId(branch.id)}
                  style={[styles.option, { backgroundColor: isSelected ? palette.primary : palette.background, borderColor: isSelected ? palette.primary : palette.border }]}
                >
                  <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{branch.branchName}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.twoColumn}>
          <FormField editable={!saving} keyboardType="decimal-pad" label="Amount" onChangeText={setAmount} placeholder="Example: 3000" value={amount} />
          <FormField editable={!saving} label="First due date (optional)" onChangeText={setDueDate} placeholder="Blank = today" value={dueDate} />
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: palette.text }]}>Frequency</Text>
          <View style={styles.optionWrap}>
            {fixedCostFrequencies.map((entry) => {
              const isSelected = entry === frequency;
              return (
                <Pressable
                  disabled={saving}
                  key={entry}
                  onPress={() => setFrequency(entry)}
                  style={[styles.option, { backgroundColor: isSelected ? palette.primary : palette.background, borderColor: isSelected ? palette.primary : palette.border }]}
                >
                  <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{frequencyLabels[entry]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FormField editable={!saving} label="Notes (optional)" onChangeText={setNotes} placeholder="Example: kay Aling Baby" value={notes} />

        {formMessage ? (
          <Text style={[styles.body, { color: formIsError ? palette.danger : palette.success }]}>{formMessage}</Text>
        ) : null}

        <Pressable
          disabled={saving || !hasBusiness}
          onPress={saveFixedCost}
          style={[styles.saveButton, { backgroundColor: palette.primary, opacity: saving || !hasBusiness ? 0.6 : 1 }]}
        >
          <Text style={[styles.saveButtonText, { color: palette.kioskHeaderText }]}>{saving ? "Saving..." : "Save Fixed Cost"}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>My fixed costs</Text>

        {overview && items.length === 0 ? (
          <EmptyState description="Example: Stall rent, ₱3,000 monthly." title="Add your first fixed cost." />
        ) : null}

        {items.map((item) => {
          const statusPill =
            item.status === "overdue"
              ? { label: "Overdue", tone: "danger" as const }
              : item.status === "due_soon"
                ? { label: "Due soon", tone: "warning" as const }
                : item.status === "done"
                  ? { label: "Bayad na", tone: "success" as const }
                  : item.status === "paid_up"
                    ? { label: "Paid up", tone: "success" as const }
                    : { label: "Scheduled", tone: "neutral" as const };

          return (
            <View key={item.cost.id} style={[styles.costRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.costHeader}>
                <View style={styles.costText}>
                  <Text style={[styles.itemTitle, { color: palette.text }]}>{item.cost.name}</Text>
                  <Text style={[styles.helper, { color: palette.mutedText }]}>
                    {categoryLabels[item.cost.category]} · {item.cost.branchName ?? "Buong negosyo"} · {frequencyLabels[item.cost.frequency]}
                  </Text>
                </View>
                <Pill label={statusPill.label} tone={statusPill.tone} />
              </View>

              <View style={styles.costMetaRow}>
                <Text style={[styles.costAmount, { color: palette.primary }]}>{formatPeso(item.cost.amount)}</Text>
                {item.nextDueDate ? (
                  <Text style={[styles.helper, { color: palette.mutedText }]}>Next due: {formatDate(item.nextDueDate)}</Text>
                ) : null}
                {item.paidCount > 0 ? (
                  <Text style={[styles.helper, { color: palette.mutedText }]}>{item.paidCount} paid</Text>
                ) : null}
              </View>

              <View style={styles.inlineActions}>
                {item.nextDueDate ? (
                  <Pressable
                    disabled={actingId !== null}
                    onPress={() => runAction(item.cost.id, "pay")}
                    style={[styles.smallButton, { borderColor: palette.border, opacity: actingId !== null ? 0.55 : 1 }]}
                  >
                    <Text style={[styles.smallButtonText, { color: palette.primary }]}>
                      {actingId === item.cost.id ? "Saving..." : "Mark paid"}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  disabled={actingId !== null}
                  onPress={() => runAction(item.cost.id, "archive")}
                  style={[styles.smallButton, { borderColor: palette.border, opacity: actingId !== null ? 0.55 : 1 }]}
                >
                  <Text style={[styles.smallButtonText, { color: palette.mutedText }]}>Archive</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </Card>

      <SecondaryButton href="/owner/reports" label="Open Kita Report" />
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
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
  costRow: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 12,
  },
  costHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  costText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    ...typography.button,
  },
  costMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  costAmount: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  smallButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
});
