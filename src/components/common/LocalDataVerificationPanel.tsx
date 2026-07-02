import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LocalDataCounts } from "@/db/schema";
import { getAppliedMigrations } from "@/db/migrations";
import { clearLocalPilotData, getLocalDataSnapshot, initializeLocalDataFoundation, seedDemoData } from "@/services/pilotData";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type VerificationState = {
  status: string;
  migrations: string[];
  counts: LocalDataCounts | null;
  error: string | null;
};

const initialState: VerificationState = {
  status: "Not initialized in this session.",
  migrations: [],
  counts: null,
  error: null,
};

export function LocalDataVerificationPanel() {
  const [state, setState] = useState<VerificationState>(initialState);
  const [busy, setBusy] = useState(false);
  const themeMode = useThemeStore((store) => store.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  async function runAction(action: () => Promise<VerificationState>) {
    setBusy(true);
    try {
      setState(await action());
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "Action failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    } finally {
      setBusy(false);
    }
  }

  async function initializeDb() {
    await runAction(async () => {
      const snapshot = await initializeLocalDataFoundation();
      return {
        status: "Database initialized. Fresh mode remains empty until demo seed is explicitly run.",
        migrations: snapshot.appliedMigrationIds,
        counts: snapshot.counts,
        error: null,
      };
    });
  }

  async function refreshCounts() {
    await runAction(async () => {
      const snapshot = await getLocalDataSnapshot();
      return {
        status: "Counts refreshed.",
        migrations: snapshot.appliedMigrationIds,
        counts: snapshot.counts,
        error: null,
      };
    });
  }

  async function seedDemo() {
    await runAction(async () => {
      const result = await seedDemoData();
      const migrations = await getAppliedMigrations();
      return {
        status: result.seeded ? "Demo data inserted by explicit development action." : (result.reason ?? "Demo seed skipped."),
        migrations: migrations.map((migration) => migration.id),
        counts: result.counts,
        error: null,
      };
    });
  }

  async function clearData() {
    await runAction(async () => {
      const counts = await clearLocalPilotData();
      const migrations = await getAppliedMigrations();
      return {
        status: "Local pilot data cleared by explicit development action.",
        migrations: migrations.map((migration) => migration.id),
        counts,
        error: null,
      };
    });
  }

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: palette.text }]}>Phase 2 Local Data Verification</Text>
      <Text style={[styles.body, { color: palette.mutedText }]}>
        Development-only controls. Fresh mode is empty by default; demo data is never seeded automatically.
      </Text>

      <View style={styles.actions}>
        <VerificationButton disabled={busy} label="Initialize DB" onPress={initializeDb} />
        <VerificationButton disabled={busy} label="Refresh Counts" onPress={refreshCounts} />
        <VerificationButton disabled={busy} label="Seed Demo Data" onPress={seedDemo} />
        <VerificationButton disabled={busy} danger label="Clear Local Data" onPress={clearData} />
      </View>

      <Text style={[styles.status, { color: state.error ? palette.danger : palette.text }]}>{state.error ?? state.status}</Text>
      <Text style={[styles.meta, { color: palette.mutedText }]}>
        Migrations: {state.migrations.length > 0 ? state.migrations.join(", ") : "none loaded"}
      </Text>

      {state.counts ? (
        <View style={styles.countGrid}>
          {Object.entries(state.counts).map(([key, value]) => (
            <Text key={key} style={[styles.meta, { color: palette.mutedText }]}>
              {key}: {value}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type VerificationButtonProps = {
  label: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
};

function VerificationButton({ label, onPress, disabled, danger = false }: VerificationButtonProps) {
  const themeMode = useThemeStore((store) => store.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: danger ? palette.danger : palette.primary,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: palette.kioskHeaderText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  title: {
    ...typography.heading,
  },
  body: {
    ...typography.body,
  },
  actions: {
    gap: spacing.sm,
  },
  button: {
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    ...typography.button,
  },
  status: {
    ...typography.body,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  countGrid: {
    gap: spacing.xs,
  },
});
