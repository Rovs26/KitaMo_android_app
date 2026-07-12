import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  AppTopBar,
  Card,
  EmptyState,
  LoadingState,
  Pill,
  ScreenScroll,
  SecondaryButton,
  SectionHeader,
} from "@/components/ui/KitaMoUI";
import type { Branch } from "@/domain/types";
import {
  loadOwnerSetupStatus,
  switchActiveBranchContext,
  switchActiveBusinessContext,
  type OwnerSetupStatus,
} from "@/services/ownerSetup";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

export default function OwnerContextScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const switchLock = useRef(false);
  const setOwnerContext = useAppStore((state) => state.setOwnerContext);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const router = useRouter();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextStatus = await loadOwnerSetupStatus();
      setStatus(nextStatus);
      setOwnerContext(nextStatus.activeBusiness, nextStatus.activeBranch);
      setError(null);
    } catch (loadError) {
      logDevError("OwnerContext.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load business context."));
    } finally {
      setLoading(false);
    }
  }, [setOwnerContext]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function chooseBusiness(businessId: string) {
    if (switchLock.current || status?.activeBusiness?.id === businessId) {
      return;
    }

    switchLock.current = true;
    setSwitchingId(businessId);
    try {
      const nextStatus = await switchActiveBusinessContext(businessId);
      setStatus(nextStatus);
      setOwnerContext(nextStatus.activeBusiness, nextStatus.activeBranch);
      setError(null);
    } catch (switchError) {
      logDevError("OwnerContext.chooseBusiness", switchError);
      setError(getFriendlyErrorMessage("Could not switch businesses."));
    } finally {
      switchLock.current = false;
      setSwitchingId(null);
    }
  }

  async function chooseBranch(branch: Branch) {
    if (switchLock.current || status?.activeBranch?.id === branch.id || !branch.active) {
      return;
    }

    switchLock.current = true;
    setSwitchingId(branch.id);
    try {
      const nextStatus = await switchActiveBranchContext(branch.id);
      setStatus(nextStatus);
      setOwnerContext(nextStatus.activeBusiness, nextStatus.activeBranch);
      setError(null);
    } catch (switchError) {
      logDevError("OwnerContext.chooseBranch", switchError);
      setError(getFriendlyErrorMessage("Could not switch stalls."));
    } finally {
      switchLock.current = false;
      setSwitchingId(null);
    }
  }

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Choose the local Owner workspace for this phone" title="Business & Stall Context" />

      <View style={[styles.notice, { backgroundColor: palette.softPrimary, borderColor: palette.border }]}>
        <Ionicons color={palette.primary} name="phone-portrait-outline" size={20} />
        <Text style={[styles.body, { color: palette.mutedText }]}>This changes local Owner context only. Kiosk still requires a separate stall confirmation for every app session.</Text>
      </View>

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      {loading && !status ? <LoadingState label="Loading saved businesses..." /> : null}

      {status ? (
        <Card>
          <SectionHeader action={<Pill label={`${status.businesses.length} saved`} tone="neutral" />} title="Businesses" />
          {status.businesses.length === 0 ? (
            <EmptyState description="Create a business before choosing Owner context." title="No businesses yet" />
          ) : (
            <View style={styles.list}>
              {status.businesses.map((business) => {
                const selected = status.activeBusiness?.id === business.id;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: switchingId !== null }}
                    disabled={switchingId !== null}
                    key={business.id}
                    onPress={() => chooseBusiness(business.id)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: selected ? palette.softPrimary : palette.background,
                        borderColor: selected ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Ionicons color={selected ? palette.primary : palette.mutedText} name="business-outline" size={22} />
                    <View style={styles.optionCopy}>
                      <Text numberOfLines={1} style={[styles.optionTitle, { color: palette.text }]}>{business.businessName}</Text>
                      <Text numberOfLines={1} style={[styles.optionMeta, { color: palette.mutedText }]}>{business.businessType} · {business.barangay}</Text>
                    </View>
                    <Pill label={switchingId === business.id ? "Switching" : selected ? "Selected" : "Use"} tone={selected ? "success" : "neutral"} />
                  </Pressable>
                );
              })}
            </View>
          )}
          <SecondaryButton href="/owner/business-settings" label={status.businesses.length === 0 ? "Create Business" : "Manage Businesses"} />
        </Card>
      ) : null}

      {status?.activeBusiness ? (
        <Card>
          <SectionHeader
            action={<Pill label={`${status.branches.filter((branch) => branch.active).length} active`} tone="success" />}
            title={`${status.activeBusiness.businessName} Stalls`}
          />
          {status.branches.length === 0 ? (
            <EmptyState description="Add a stall before choosing an operational context." title="No stalls in this business" />
          ) : (
            <View style={styles.list}>
              {status.branches.map((branch) => {
                const selected = status.activeBranch?.id === branch.id;
                const productCount = status.products.filter((product) => product.branchId === branch.id).length;
                return (
                  <View key={branch.id} style={[styles.stallRow, { backgroundColor: palette.background, borderColor: selected ? palette.primary : palette.border }]}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: !branch.active || switchingId !== null }}
                      disabled={!branch.active || switchingId !== null}
                      onPress={() => chooseBranch(branch)}
                      style={styles.stallSelect}
                    >
                      <Ionicons color={branch.active ? palette.primary : palette.mutedText} name="storefront-outline" size={21} />
                      <View style={styles.optionCopy}>
                        <Text numberOfLines={1} style={[styles.optionTitle, { color: palette.text }]}>{branch.branchName}</Text>
                        <Text numberOfLines={1} style={[styles.optionMeta, { color: palette.mutedText }]}>
                          {branch.location ?? branch.branchType} · {productCount} assigned product{productCount === 1 ? "" : "s"}
                        </Text>
                      </View>
                      <Pill
                        label={switchingId === branch.id ? "Switching" : selected ? "Selected" : branch.active ? "Use" : "Inactive"}
                        tone={selected ? "success" : branch.active ? "neutral" : "warning"}
                      />
                    </Pressable>
                    {branch.active ? (
                      <Pressable
                        accessibilityLabel={`Open Kiosk picker for ${branch.branchName}`}
                        onPress={() => router.push({ pathname: "/kiosk", params: { branchId: branch.id } })}
                        style={[styles.kioskButton, { borderColor: palette.border }]}
                      >
                        <Ionicons color={palette.primary} name="storefront" size={16} />
                        <Text style={[styles.kioskText, { color: palette.primary }]}>Open Kiosk</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
          <SecondaryButton href="/owner/business-settings" label="Manage Stalls" />
        </Card>
      ) : status && status.businesses.length > 0 ? (
        <Card>
          <EmptyState description="Choose a saved business deliberately. KitaMo will not silently select one." title="No business selected" />
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "flex-start",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  body: {
    ...typography.body,
    flex: 1,
  },
  message: {
    ...typography.body,
  },
  list: {
    gap: spacing.sm,
  },
  option: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.sm,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  optionMeta: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  stallRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  stallSelect: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.sm,
  },
  kioskButton: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
  },
  kioskText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
});

