import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const localData = [
  "Business and stall details",
  "Products, stock, grocery lots, recipes, and production",
  "Sales, receipts, payment methods, and typed payment references",
  "Transfers, spoilage, fixed costs, and reports",
  "Local preferences, favorites, and recent Kiosk products",
];

export default function PrivacyScreen() {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const router = useRouter();

  return (
    <ScreenScroll>
      <AppTopBar subtitle="How this Android app handles local business data." title="Privacy Policy" />

      <Card>
        <View style={styles.headingRow}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Local-only release</Text>
          <Pill label="No cloud" tone="success" />
        </View>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          KitaMo stores the information you enter in a local SQLite database on this phone. This release has no account, cloud
          sync, analytics, ads, or server connection, and it does not transmit your business records.
        </Text>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Data stored on this phone</Text>
        {localData.map((item) => (
          <Text key={item} style={[styles.body, { color: palette.mutedText }]}>• {item}</Text>
        ))}
        <Text style={[styles.body, { color: palette.mutedText }]}>
          If Owner protection is enabled, KitaMo stores a salted PIN hash in Android secure storage. The PIN itself is not stored.
          Android handles fingerprint or face confirmation and returns only success or cancel to KitaMo.
        </Text>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Device features</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          KitaMo reads network status only for the local-mode badge, uses haptics for tap feedback, and opens the Android
          clipboard or share sheet only when you choose Copy or Share. It does not request camera, microphone, location,
          contacts, photos, Bluetooth, legacy storage, or internet access.
        </Text>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Retention and deletion</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          Android backup is disabled. Data remains until you use Clear All Local Pilot Data, clear app storage, or uninstall the
          app. A confirmed local reset removes business records, settings, the local save queue, and Owner protection. Data
          cannot be recovered because this release has no backup service.
        </Text>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Sharing and changes</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          KitaMo does not sell or share data. Receipt text leaves the app only when you intentionally choose another app from the
          Android share sheet. If a future version adds accounts, backup, or any transmission, this policy and the Play listing
          must be updated before release. Use the support contact on the KitaMo Google Play listing for privacy questions.
        </Text>
      </Card>

      <SecondaryButton label="Back" onPress={() => router.back()} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...typography.heading,
    flex: 1,
  },
  body: {
    ...typography.body,
  },
});
