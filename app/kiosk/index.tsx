import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, LoadingState, Pill, PrimaryButton, ScreenScroll, SecondaryButton, SectionHeader } from "@/components/ui/KitaMoUI";
import type { Branch } from "@/domain/types";
import { loadOwnerSetupStatus, switchActiveBranchContext, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

export default function KioskStallSelectionScreen() {
  const params = useLocalSearchParams<{ branchId?: string }>();
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openingLock = useRef(false);
  const confirmKioskContext = useAppStore((state) => state.confirmKioskContext);
  const clearKioskSession = useAppStore((state) => state.clearKioskSession);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const router = useRouter();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextStatus = await loadOwnerSetupStatus();
      const activeBranches = nextStatus.branches.filter((branch) => branch.active);
      const requestedBranchId = Array.isArray(params.branchId) ? params.branchId[0] : params.branchId;
      const requestedBranch = activeBranches.find((branch) => branch.id === requestedBranchId);
      setStatus(nextStatus);
      setSelectedBranchId(requestedBranch?.id ?? null);
      setError(null);
    } catch (loadError) {
      logDevError("KioskStallSelection.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load your stalls."));
    } finally {
      setLoading(false);
    }
  }, [params.branchId]);

  useFocusEffect(
    useCallback(() => {
      clearKioskSession();
      void refresh();
    }, [clearKioskSession, refresh]),
  );

  const activeBranches = useMemo(() => status?.branches.filter((branch) => branch.active) ?? [], [status?.branches]);
  const selectedBranch = activeBranches.find((branch) => branch.id === selectedBranchId) ?? null;

  async function openKiosk() {
    if (openingLock.current || !selectedBranch) {
      return;
    }

    openingLock.current = true;
    setOpening(true);
    setError(null);
    try {
      const nextStatus = await switchActiveBranchContext(selectedBranch.id);
      if (!nextStatus.activeBusiness || !nextStatus.activeBranch) {
        throw new Error("Kiosk requires a valid business and active stall.");
      }
      confirmKioskContext(nextStatus.activeBusiness, nextStatus.activeBranch);
      router.replace("/kiosk/sell");
    } catch (openError) {
      logDevError("KioskStallSelection.openKiosk", openError);
      setError(getFriendlyErrorMessage("Could not open Kiosk for this stall."));
    } finally {
      openingLock.current = false;
      setOpening(false);
    }
  }

  return (
    <ScreenScroll>
      <AppTopBar subtitle="Select the stall using this shared device" title="Choose Kiosk Stall" />

      <View style={[styles.localNotice, { backgroundColor: palette.softAccent, borderColor: palette.border }]}>
        <Ionicons color={palette.accent} name="people-outline" size={21} />
        <View style={styles.noticeCopy}>
          <Text style={[styles.noticeTitle, { color: palette.text }]}>Shared-device Kiosk</Text>
          <Text style={[styles.body, { color: palette.mutedText }]}>The selected stall controls which products and sales this Kiosk session uses. Seller accounts and remote access are not enabled.</Text>
        </View>
      </View>

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      {loading ? <LoadingState label="Loading active stalls..." /> : null}

      {!loading && !status?.activeBusiness ? (
        <Card>
          <EmptyState
            description={status?.businesses.length ? "Choose a saved business deliberately before opening Kiosk." : "Create the local business profile before opening Kiosk."}
            title={status?.businesses.length ? "No business selected" : "Business setup needed"}
          />
          <SecondaryButton
            href={status?.businesses.length ? "/owner/context" : "/owner/business-settings"}
            label={status?.businesses.length ? "Choose Business" : "Open Business & Stalls"}
          />
        </Card>
      ) : null}

      {!loading && status?.activeBusiness && activeBranches.length === 0 ? (
        <Card>
          <EmptyState description="Add or activate a stall before opening Kiosk." title="No active stalls" />
          <SecondaryButton href="/owner/business-settings" label="Manage Stalls" />
        </Card>
      ) : null}

      {!loading && activeBranches.length > 0 ? (
        <Card>
          <SectionHeader action={<Pill label={`${activeBranches.length} active`} tone="success" />} title={status?.activeBusiness?.businessName ?? "Active stalls"} />
          <View style={styles.stallList}>
            {activeBranches.map((branch) => (
              <KioskStallOption
                branch={branch}
                key={branch.id}
                onSelect={() => setSelectedBranchId(branch.id)}
                productCount={countProductsForBranch(status, branch.id)}
                selected={selectedBranchId === branch.id}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {selectedBranch ? (
        <View style={[styles.confirmBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.confirmCopy}>
            <Text style={[styles.confirmLabel, { color: palette.mutedText }]}>Opening Kiosk for</Text>
            <Text numberOfLines={1} style={[styles.confirmStall, { color: palette.text }]}>{selectedBranch.branchName}</Text>
          </View>
          <Ionicons color={palette.primary} name="checkmark-circle" size={24} />
        </View>
      ) : null}

      <PrimaryButton disabled={!selectedBranch || opening} label={opening ? "Opening Kiosk..." : "Open Selected Kiosk"} onPress={openKiosk} />
      <SecondaryButton href="/owner" label="Back to Owner Home" />
    </ScreenScroll>
  );
}

function countProductsForBranch(status: OwnerSetupStatus | null, branchId: string) {
  return status?.products.filter((product) => product.active && (product.branchId === branchId || product.branchId === null)).length ?? 0;
}

function KioskStallOption({
  branch,
  productCount,
  selected,
  onSelect,
}: {
  branch: Branch;
  productCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      style={[
        styles.stallOption,
        {
          backgroundColor: selected ? palette.softPrimary : palette.background,
          borderColor: selected ? palette.primary : palette.border,
        },
      ]}
    >
      <View style={[styles.stallIcon, { backgroundColor: selected ? palette.primary : palette.surface }]}>
        <Ionicons color={selected ? palette.kioskHeaderText : palette.primary} name="storefront-outline" size={22} />
      </View>
      <View style={styles.stallCopy}>
        <Text style={[styles.stallName, { color: palette.text }]}>{branch.branchName}</Text>
        <Text style={[styles.stallMeta, { color: palette.mutedText }]}>
          {branch.location ?? branch.branchType} · {productCount} product{productCount === 1 ? "" : "s"}
        </Text>
      </View>
      <Ionicons color={selected ? palette.primary : palette.mutedText} name={selected ? "radio-button-on" : "radio-button-off"} size={23} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  localNotice: {
    alignItems: "flex-start",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  noticeTitle: {
    ...typography.button,
  },
  body: {
    ...typography.body,
  },
  message: {
    ...typography.body,
  },
  stallList: {
    gap: spacing.sm,
  },
  stallOption: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 70,
    padding: spacing.sm + 2,
  },
  stallIcon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  stallCopy: {
    flex: 1,
    gap: 2,
  },
  stallName: {
    ...typography.button,
  },
  stallMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  confirmBar: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  confirmCopy: {
    flex: 1,
    gap: 2,
  },
  confirmLabel: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  confirmStall: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
});
