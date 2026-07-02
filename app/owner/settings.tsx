import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PilotStatusCard } from "@/components/owner/PilotStatusCard";
import {
  createBranch,
  createBusiness,
  updateBranch,
  updateBusiness,
} from "@/db/repositories";
import type { Branch, BusinessType } from "@/domain/types";
import { loadOwnerSetupStatus, setActiveBranch, setActiveBusiness, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const businessTypes: BusinessType[] = [
  "sari-sari store",
  "karinderia",
  "street food",
  "kiosk",
  "school canteen",
  "small booth",
  "other",
];

const branchTypes = ["stall", "branch", "booth", "home kitchen", "pop-up"] as const;

type BranchTypeOption = (typeof branchTypes)[number];

type BusinessForm = {
  businessName: string;
  businessType: BusinessType;
  ownerName: string;
  contactNumber: string;
  barangay: string;
  notes: string;
};

type BranchForm = {
  id: string | null;
  branchName: string;
  location: string;
  branchType: BranchTypeOption;
  active: boolean;
  notes: string;
};

const emptyBusinessForm: BusinessForm = {
  businessName: "",
  businessType: "sari-sari store",
  ownerName: "",
  contactNumber: "",
  barangay: "",
  notes: "",
};

const emptyBranchForm: BranchForm = {
  id: null,
  branchName: "",
  location: "",
  branchType: "stall",
  active: true,
  notes: "",
};

export default function OwnerSettingsScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [businessForm, setBusinessForm] = useState<BusinessForm>(emptyBusinessForm);
  const [branchForm, setBranchForm] = useState<BranchForm>(emptyBranchForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const setActiveBusinessId = useAppStore((state) => state.setActiveBusinessId);
  const setActiveBranchId = useAppStore((state) => state.setActiveBranchId);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextStatus = await loadOwnerSetupStatus();
    setStatus(nextStatus);
    setActiveBusinessId(nextStatus.activeBusiness?.id ?? null);
    setActiveBranchId(nextStatus.activeBranch?.id ?? null);

    if (nextStatus.activeBusiness) {
      setBusinessForm({
        businessName: nextStatus.activeBusiness.businessName,
        businessType: nextStatus.activeBusiness.businessType,
        ownerName: nextStatus.activeBusiness.ownerName,
        contactNumber: nextStatus.activeBusiness.contactNumber ?? "",
        barangay: nextStatus.activeBusiness.barangay,
        notes: nextStatus.activeBusiness.notes ?? "",
      });
    }
  }, [setActiveBranchId, setActiveBusinessId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      refresh().catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Could not load settings.");
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  async function saveBusinessProfile() {
    const businessName = businessForm.businessName.trim();
    const ownerName = businessForm.ownerName.trim();
    const barangay = businessForm.barangay.trim();

    if (!businessName || !ownerName || !barangay) {
      setMessage("Business name, owner/contact name, and address/location are required.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        businessName,
        businessType: businessForm.businessType,
        ownerName,
        barangay,
        contactNumber: businessForm.contactNumber.trim() || null,
        notes: businessForm.notes.trim() || null,
        preferredLanguage: "Taglish" as const,
      };

      const savedBusiness = status?.activeBusiness
        ? await updateBusiness(status.activeBusiness.id, payload)
        : await createBusiness(payload);

      await setActiveBusiness(savedBusiness.id);
      setActiveBusinessId(savedBusiness.id);
      await refresh();
      setMessage(status?.activeBusiness ? "Business profile updated." : "Business profile created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save business profile.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBranch() {
    if (!status?.activeBusiness) {
      setMessage("Create your business profile before adding a stall or store.");
      return;
    }

    const branchName = branchForm.branchName.trim();
    if (!branchName) {
      setMessage("Stall or branch name is required.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        branchName,
        location: branchForm.location.trim() || null,
        branchType: branchForm.branchType,
        active: branchForm.active,
        notes: branchForm.notes.trim() || null,
      };
      const savedBranch = branchForm.id
        ? await updateBranch(branchForm.id, payload)
        : await createBranch({
            ...payload,
            businessId: status.activeBusiness.id,
          });

      if (savedBranch.active || !status.activeBranch) {
        await setActiveBranch(savedBranch.id);
        setActiveBranchId(savedBranch.id);
      }

      setBranchForm(emptyBranchForm);
      await refresh();
      setMessage(branchForm.id ? "Store or stall updated." : "Store or stall added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save store or stall.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseActiveBranch(branchId: string) {
    setSaving(true);
    setMessage(null);
    try {
      await setActiveBranch(branchId);
      setActiveBranchId(branchId);
      await refresh();
      setMessage("Active stall updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not select active stall.");
    } finally {
      setSaving(false);
    }
  }

  function editBranch(branch: Branch) {
    setBranchForm({
      id: branch.id,
      branchName: branch.branchName,
      location: branch.location ?? "",
      branchType: branch.branchType === "kiosk" ? "stall" : branch.branchType,
      active: branch.active,
      notes: branch.notes ?? "",
    });
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>Owner Settings</Text>
        <Text style={[styles.title, { color: palette.text }]}>Business setup</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          Save the local profile and stall records used by Owner and future Kiosk flows.
        </Text>
      </View>

      {message ? <Text style={[styles.message, { color: message.includes("Could not") ? palette.danger : palette.text }]}>{message}</Text> : null}

      <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Business Profile</Text>
        {!status?.activeBusiness ? (
          <Text style={[styles.empty, { color: palette.mutedText }]}>
            Create your business profile to start tracking sales and inventory.
          </Text>
        ) : null}

        <FormField
          label="Business name"
          onChangeText={(businessName) => setBusinessForm((form) => ({ ...form, businessName }))}
          placeholder="Example: Aling Nena's Store"
          value={businessForm.businessName}
        />
        <OptionGroup
          label="Business type"
          onSelect={(businessType) => setBusinessForm((form) => ({ ...form, businessType }))}
          options={businessTypes}
          selected={businessForm.businessType}
        />
        <FormField
          label="Owner/contact name"
          onChangeText={(ownerName) => setBusinessForm((form) => ({ ...form, ownerName }))}
          placeholder="Owner or staff contact"
          value={businessForm.ownerName}
        />
        <FormField
          keyboardType="phone-pad"
          label="Phone/contact number"
          onChangeText={(contactNumber) => setBusinessForm((form) => ({ ...form, contactNumber }))}
          placeholder="Optional"
          value={businessForm.contactNumber}
        />
        <FormField
          label="Address/location"
          onChangeText={(barangay) => setBusinessForm((form) => ({ ...form, barangay }))}
          placeholder="Barangay, market, mall, or route"
          value={businessForm.barangay}
        />
        <FormField
          label="Notes/description"
          multiline
          onChangeText={(notes) => setBusinessForm((form) => ({ ...form, notes }))}
          placeholder="Optional local notes"
          value={businessForm.notes}
        />

        <ActionButton disabled={saving} label={status?.activeBusiness ? "Save Business Profile" : "Create Business Profile"} onPress={saveBusinessProfile} />
      </View>

      <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Stores / Stalls</Text>
        {!status?.activeBusiness ? (
          <Text style={[styles.empty, { color: palette.mutedText }]}>Create a business profile before adding stores or stalls.</Text>
        ) : status.branches.length === 0 ? (
          <Text style={[styles.empty, { color: palette.mutedText }]}>Add your first stall or store.</Text>
        ) : null}

        {status?.branches.map((branch) => {
          const selected = status.activeBranch?.id === branch.id;
          return (
            <View key={branch.id} style={[styles.listItem, { borderColor: palette.border }]}>
              <View style={styles.listItemHeader}>
                <View style={styles.listItemText}>
                  <Text style={[styles.listItemTitle, { color: palette.text }]}>{branch.branchName}</Text>
                  <Text style={[styles.body, { color: palette.mutedText }]}>
                    {branch.branchType} | {branch.location ?? "No location"} | {branch.active ? "active" : "inactive"}
                  </Text>
                </View>
                <Text style={[styles.badge, { backgroundColor: selected ? palette.primary : palette.background, color: selected ? palette.kioskHeaderText : palette.mutedText }]}>
                  {selected ? "Active" : "Saved"}
                </Text>
              </View>
              {branch.notes ? <Text style={[styles.body, { color: palette.mutedText }]}>{branch.notes}</Text> : null}
              <View style={styles.inlineActions}>
                <SmallButton disabled={saving} label="Edit" onPress={() => editBranch(branch)} />
                <SmallButton disabled={saving || selected} label="Set active" onPress={() => chooseActiveBranch(branch.id)} />
              </View>
            </View>
          );
        })}

        <Text style={[styles.subheading, { color: palette.text }]}>{branchForm.id ? "Edit stall/store" : "Add stall/store"}</Text>
        <FormField
          editable={Boolean(status?.activeBusiness)}
          label="Stall/branch name"
          onChangeText={(branchName) => setBranchForm((form) => ({ ...form, branchName }))}
          placeholder="Example: Main stall"
          value={branchForm.branchName}
        />
        <FormField
          editable={Boolean(status?.activeBusiness)}
          label="Location"
          onChangeText={(location) => setBranchForm((form) => ({ ...form, location }))}
          placeholder="Optional"
          value={branchForm.location}
        />
        <OptionGroup
          disabled={!status?.activeBusiness}
          label="Type"
          onSelect={(branchType) => setBranchForm((form) => ({ ...form, branchType }))}
          options={branchTypes}
          selected={branchForm.branchType}
        />
        <OptionGroup
          disabled={!status?.activeBusiness}
          label="Status"
          onSelect={(activeLabel) => setBranchForm((form) => ({ ...form, active: activeLabel === "active" }))}
          options={["active", "inactive"] as const}
          selected={branchForm.active ? "active" : "inactive"}
        />
        <FormField
          editable={Boolean(status?.activeBusiness)}
          label="Notes"
          multiline
          onChangeText={(notes) => setBranchForm((form) => ({ ...form, notes }))}
          placeholder="Optional"
          value={branchForm.notes}
        />
        <View style={styles.inlineActions}>
          <ActionButton disabled={saving || !status?.activeBusiness} label={branchForm.id ? "Save Store/Stall" : "Add Store/Stall"} onPress={saveBranch} />
          {branchForm.id ? <SmallButton disabled={saving} label="Cancel edit" onPress={() => setBranchForm(emptyBranchForm)} /> : null}
        </View>
      </View>

      {status ? <PilotStatusCard status={status} /> : null}
    </ScrollView>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad" | "numeric" | "decimal-pad";
  editable?: boolean;
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
  editable = true,
}: FormFieldProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        style={[
          styles.input,
          multiline ? styles.multilineInput : null,
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
          const isSelected = option === selected;
          return (
            <Pressable
              disabled={disabled}
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? palette.primary : palette.background,
                  borderColor: isSelected ? palette.primary : palette.border,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: isSelected ? palette.kioskHeaderText : palette.text }]}>{option}</Text>
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
  section: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
  },
  empty: {
    ...typography.body,
  },
  subheading: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
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
    fontSize: 16,
    lineHeight: 22,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 48,
    minWidth: 180,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionButtonText: {
    ...typography.button,
  },
  listItem: {
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  listItemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  listItemText: {
    flex: 1,
    gap: spacing.xs,
  },
  listItemTitle: {
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
  inlineActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  smallButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
});
