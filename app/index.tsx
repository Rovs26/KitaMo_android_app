import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
  const [message, setMessage] = useState("Preparing local database.");

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

        setMessage("Choose how to start this local pilot.");
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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>KitaMo Android</Text>
        <Text style={[styles.title, { color: palette.text }]}>Start your local pilot</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          Fresh mode starts empty. Demo data is only added when you choose it here.
        </Text>
      </View>

      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.panelTitle, { color: palette.text }]}>First-run choice</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>{message}</Text>

        <Pressable
          disabled={disabled}
          onPress={startFresh}
          style={[
            styles.primaryAction,
            {
              backgroundColor: palette.primary,
              opacity: disabled ? 0.65 : 1,
            },
          ]}
        >
          <Text style={[styles.primaryActionText, { color: palette.kioskHeaderText }]}>
            {busy === "fresh" ? "Starting..." : "Start Fresh Business"}
          </Text>
        </Pressable>

        <Pressable
          disabled={disabled}
          onPress={tryDemoData}
          style={[
            styles.secondaryAction,
            {
              backgroundColor: palette.background,
              borderColor: palette.border,
              opacity: disabled ? 0.65 : 1,
            },
          ]}
        >
          <Text style={[styles.secondaryActionText, { color: palette.primary }]}>
            {busy === "demo" ? "Creating demo..." : "Try Demo Data"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.label,
  },
  title: {
    ...typography.display,
  },
  body: {
    ...typography.body,
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  panelTitle: {
    ...typography.heading,
  },
  primaryAction: {
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryActionText: {
    ...typography.button,
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    ...typography.button,
  },
});
