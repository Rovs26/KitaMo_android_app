import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, IconBadge, LoadingState, Pill, ScreenScroll, SectionHeader } from "@/components/ui/KitaMoUI";
import { getOwnerAccessStatus, type OwnerAccessStatus } from "@/services/ownerAccess";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

type SettingsRowProps = {
  title: string;
  description: string;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "accent" | "warning";
};

export default function OwnerSettingsIndexScreen() {
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [ownerAccess, setOwnerAccess] = useState<OwnerAccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStatus, nextOwnerAccess] = await Promise.all([loadOwnerSetupStatus(), getOwnerAccessStatus()]);
      setStatus(nextStatus);
      setOwnerAccess(nextOwnerAccess);
      setError(null);
    } catch (loadError) {
      logDevError("OwnerSettingsIndex.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Business, access, privacy, and app information" title="Settings" />

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      {loading && !status ? <LoadingState label="Loading local settings..." /> : null}

      {status ? (
        <Card>
          <View style={styles.contextRow}>
            <IconBadge icon="business-outline" size="lg" tone="primary" />
            <View style={styles.contextCopy}>
              <Text numberOfLines={1} style={[styles.contextTitle, { color: palette.text }]}>
                {status.activeBusiness?.businessName ?? "No business profile yet"}
              </Text>
              <Text style={[styles.body, { color: palette.mutedText }]}>
                {status.activeBusiness
                  ? `${status.activeBranch?.branchName ?? "No active stall"} · ${status.stallCount} stall${status.stallCount === 1 ? "" : "s"}`
                  : "Set up a business and stall before opening Kiosk."}
              </Text>
            </View>
            <Pill label={status.mode === "demo" ? "Demo" : "Local"} tone={status.mode === "demo" ? "accent" : "success"} />
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Business & Access" />
        <SettingsRow
          description="Business profile, stores, stalls, and the active Kiosk stall"
          href="/owner/business-settings"
          icon="storefront-outline"
          title="Business & Stalls"
        />
        <SettingsRow
          description={ownerAccess?.hasPin ? "Owner PIN is on; manage PIN and device biometrics" : "Protect Owner Mode on a shared device"}
          href="/owner/business-settings"
          icon="shield-checkmark-outline"
          title="Owner Access & Security"
          tone={ownerAccess?.hasPin ? "primary" : "warning"}
        />
      </Card>

      <Card>
        <SectionHeader title="Alerts & Data" />
        <SettingsRow
          description="Active and resolved alerts saved locally on this phone"
          href="/owner/notifications"
          icon="notifications-outline"
          title="Local Notifications"
          tone="warning"
        />
        <SettingsRow
          description="How KitaMo stores and handles local business records"
          href="/privacy"
          icon="lock-closed-outline"
          title="Privacy Policy"
        />
      </Card>

      <Card>
        <SectionHeader title="App & Help" />
        <SettingsRow
          description="Version, package, pilot scope, and app information"
          href="/owner/about"
          icon="information-circle-outline"
          title="About KitaMo"
          tone="accent"
        />
        <SettingsRow
          description="A guided local seller pilot walkthrough"
          href="/owner/pilot-guide"
          icon="help-circle-outline"
          title="Pilot Guide"
        />
      </Card>
    </ScreenScroll>
  );
}

function SettingsRow({ title, description, href, icon, tone = "primary" }: SettingsRowProps) {
  const router = useRouter();
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const iconBackground = tone === "accent" ? palette.softAccent : tone === "warning" ? palette.softWarning : palette.softPrimary;
  const iconColor = tone === "accent" ? palette.accent : tone === "warning" ? palette.warning : palette.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.settingsRow, { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBackground }]}>
        <Ionicons color={iconColor} name={icon} size={21} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.rowDescription, { color: palette.mutedText }]}>{description}</Text>
      </View>
      <Ionicons color={palette.mutedText} name="chevron-forward" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.body,
  },
  contextRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  contextCopy: {
    flex: 1,
    gap: 2,
  },
  contextTitle: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  body: {
    ...typography.body,
  },
  settingsRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    paddingTop: spacing.sm,
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.button,
  },
  rowDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
});
