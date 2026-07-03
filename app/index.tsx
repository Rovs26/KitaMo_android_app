import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, IconBadge, KitaMoBrand, PrimaryButton, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { completeDemoFirstRun, completeFreshFirstRun, loadOwnerSetupStatus } from "@/services/ownerSetup";
import { useAppStore } from "@/state/appStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

export default function WelcomeScreen() {
  const router = useRouter();
  const setCurrentMode = useAppStore((state) => state.setCurrentMode);
  const setActiveBusinessId = useAppStore((state) => state.setActiveBusinessId);
  const setActiveBranchId = useAppStore((state) => state.setActiveBranchId);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<"fresh" | "demo" | null>(null);
  const [message, setMessage] = useState("Preparing local data.");

  useEffect(() => {
    let mounted = true;

    async function checkFirstRun() {
      try {
        const status = await loadOwnerSetupStatus();
        if (!mounted) {
          return;
        }

        setActiveBusinessId(status.activeBusiness?.id ?? null);
        setActiveBranchId(status.activeBranch?.id ?? null);

        if (status.firstRunComplete) {
          setCurrentMode("owner");
          router.replace("/owner");
          return;
        }

        setMessage("Fresh mode starts empty. Demo mode uses sample data.");
      } catch (error) {
        logDevError("Welcome.checkFirstRun", error);
        if (mounted) {
          setMessage(getFriendlyErrorMessage("Could not prepare local data."));
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    checkFirstRun();

    return () => {
      mounted = false;
    };
  }, [router, setActiveBranchId, setActiveBusinessId, setCurrentMode]);

  async function startFresh() {
    setBusy("fresh");
    setMessage("Starting with an empty local workspace.");
    try {
      await completeFreshFirstRun();
      setActiveBusinessId(null);
      setActiveBranchId(null);
      setCurrentMode("owner");
      router.replace("/owner");
    } catch (error) {
      logDevError("Welcome.startFresh", error);
      setMessage(getFriendlyErrorMessage("Could not start fresh mode."));
    } finally {
      setBusy(null);
    }
  }

  async function tryDemoData() {
    setBusy("demo");
    setMessage("Creating demo business, stall, and products.");
    try {
      await completeDemoFirstRun();
      const status = await loadOwnerSetupStatus();
      setActiveBusinessId(status.activeBusiness?.id ?? null);
      setActiveBranchId(status.activeBranch?.id ?? null);
      setCurrentMode("owner");
      router.replace("/owner");
    } catch (error) {
      logDevError("Welcome.tryDemoData", error);
      setMessage(getFriendlyErrorMessage("Could not create demo data."));
    } finally {
      setBusy(null);
    }
  }

  const disabled = checking || busy !== null;

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <KitaMoBrand centered />
        <Text style={[styles.title, { color: palette.text }]}>Kita mo agad ang negosyo mo</Text>
        <Text style={[styles.subtitle, { color: palette.mutedText }]}>
          Kita mo agad ang benta, gastos, paninda, at resibo.
        </Text>
      </View>

      <Card style={styles.choiceCard}>
        <View style={styles.choiceHeader}>
          <IconBadge label="K" tone="primary" size="lg" />
          <View style={styles.choiceText}>
            <Text style={[styles.choiceTitle, { color: palette.text }]}>Start local-first</Text>
            <Text style={[styles.body, { color: palette.mutedText }]}>{message}</Text>
          </View>
        </View>

        <PrimaryButton disabled={disabled} label={busy === "fresh" ? "Starting..." : "Start Fresh Business"} onPress={startFresh} />
        <SecondaryButton disabled={disabled} label={busy === "demo" ? "Creating demo..." : "Try Demo Data"} onPress={tryDemoData} />
      </Card>

      <View style={styles.infoGrid}>
        <ModeTile
          description="No sample products, sales, or records."
          disabled={disabled}
          label="Fresh"
          onPress={startFresh}
          toneColor={palette.primary}
        />
        <ModeTile
          description="One sample business, stall, and products."
          disabled={disabled}
          label="Demo"
          onPress={tryDemoData}
          toneColor={palette.accent}
        />
      </View>
    </ScreenScroll>
  );
}

type ModeTileProps = {
  label: string;
  description: string;
  toneColor: string;
  disabled: boolean;
  onPress: () => void;
};

function ModeTile({ label, description, toneColor, disabled, onPress }: ModeTileProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.modeTile, { backgroundColor: palette.surface, borderColor: palette.border, opacity: disabled ? 0.68 : 1 }]}
    >
      <Text style={[styles.modeLabel, { color: toneColor }]}>{label}</Text>
      <Text style={[styles.modeDescription, { color: palette.mutedText }]}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    textAlign: "center",
  },
  choiceCard: {
    marginTop: spacing.md,
  },
  choiceHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  choiceText: {
    flex: 1,
    gap: spacing.xs,
  },
  choiceTitle: {
    ...typography.heading,
  },
  body: {
    ...typography.body,
  },
  infoGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modeTile: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  modeLabel: {
    ...typography.button,
  },
  modeDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
