import Constants from "expo-constants";
import { StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, IconBadge, KitaMoBrand, Pill, ScreenScroll, SecondaryButton, SectionHeader } from "@/components/ui/KitaMoUI";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function AboutKitaMoScreen() {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const packageName = Constants.expoConfig?.android?.package ?? "ph.kitamo.app";

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="App information and current pilot scope" title="About KitaMo" />

      <Card>
        <View style={styles.identityRow}>
          <IconBadge icon="storefront-outline" size="lg" tone="primary" />
          <View style={styles.identityCopy}>
            <KitaMoBrand />
            <Text style={[styles.body, { color: palette.mutedText }]}>Local-first selling and business records for Filipino small businesses.</Text>
          </View>
          <Pill label={`v${version}`} tone="accent" />
        </View>
      </Card>

      <Card>
        <SectionHeader title="This Android build" />
        <InfoRow label="App name" value="KitaMo" />
        <InfoRow label="Version" value={version} />
        <InfoRow label="Package" value={packageName} />
        <InfoRow label="Data storage" value="Local SQLite on this phone" />
        <InfoRow label="Kiosk model" value="Stall-specific, shared device" />
      </Card>

      <Card>
        <SectionHeader title="Internal Testing scope" />
        <Text style={[styles.body, { color: palette.mutedText }]}>Owner Mode manages the local business and stalls. A stall must be selected before this phone enters Kiosk Mode.</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>Seller accounts, join codes, remote approvals, scheduled shifts, push notifications, and cloud sync are not enabled in this build.</Text>
      </Card>

      <Card>
        <SectionHeader title="Privacy & help" />
        <SecondaryButton href="/privacy" label="Privacy Policy" />
        <SecondaryButton href="/owner/pilot-guide" label="Pilot Guide" />
        <SecondaryButton href="/owner/settings" label="Back to Settings" />
      </Card>
    </ScreenScroll>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={[styles.infoRow, { borderColor: palette.border }]}>
      <Text style={[styles.infoLabel, { color: palette.mutedText }]}>{label}</Text>
      <Text selectable style={[styles.infoValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  identityCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  body: {
    ...typography.body,
  },
  infoRow: {
    alignItems: "flex-start",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "right",
  },
});
