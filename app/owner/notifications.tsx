import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, LoadingState, Pill, ScreenScroll, SectionHeader } from "@/components/ui/KitaMoUI";
import { listRecentOwnerAlerts, resolveOwnerAlert } from "@/db/repositories";
import type { OwnerAlert, OwnerAlertSeverity } from "@/domain/types";
import { loadOwnerSetupStatus, type OwnerSetupStatus } from "@/services/ownerSetup";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

type AlertView = "active" | "resolved";
type AlertScope = "all" | "business" | "activeStall";

const severityLabels: Record<OwnerAlertSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

const severityTones: Record<OwnerAlertSeverity, "neutral" | "warning" | "danger"> = {
  info: "neutral",
  warning: "warning",
  critical: "danger",
};

export default function OwnerNotificationsScreen() {
  const [alerts, setAlerts] = useState<OwnerAlert[]>([]);
  const [status, setStatus] = useState<OwnerSetupStatus | null>(null);
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});
  const [view, setView] = useState<AlertView>("active");
  const [scope, setScope] = useState<AlertScope>("all");
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolveLock = useRef(false);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];
  const router = useRouter();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const status = await loadOwnerSetupStatus();
      const nextAlerts = status.activeBusiness ? await listRecentOwnerAlerts(status.activeBusiness.id, 100) : [];
      setStatus(status);
      setAlerts(nextAlerts);
      setBranchNames(Object.fromEntries(status.branches.map((branch) => [branch.id, branch.branchName])));
      setScope((current) => (current === "activeStall" && !status.activeBranch ? "all" : current));
      setError(null);
    } catch (loadError) {
      logDevError("OwnerNotifications.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load local alerts."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const activeCount = useMemo(() => alerts.filter((alert) => alert.status === "active").length, [alerts]);
  const resolvedCount = alerts.length - activeCount;
  const visibleAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        if (alert.status !== view) {
          return false;
        }

        if (scope === "business") {
          return alert.branchId === null;
        }

        if (scope === "activeStall") {
          return Boolean(status?.activeBranch && alert.branchId === status.activeBranch.id);
        }

        return true;
      }),
    [alerts, scope, status?.activeBranch, view],
  );

  async function resolve(alertId: string) {
    if (resolveLock.current) {
      return;
    }

    resolveLock.current = true;
    setResolvingId(alertId);
    try {
      await resolveOwnerAlert(alertId);
      await refresh();
    } catch (resolveError) {
      logDevError("OwnerNotifications.resolve", resolveError);
      setError(getFriendlyErrorMessage("Could not resolve the alert."));
    } finally {
      resolveLock.current = false;
      setResolvingId(null);
    }
  }

  return (
    <ScreenScroll bottomNav>
      <AppTopBar
        right={
          <Pressable
            accessibilityLabel="Settings"
            hitSlop={8}
            onPress={() => router.push("/owner/settings")}
            style={[styles.headerButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Ionicons color={palette.primary} name="settings-outline" size={20} />
          </Pressable>
        }
        subtitle="Alerts saved on this phone"
        title="Notifications"
      />

      <View style={[styles.localNotice, { backgroundColor: palette.softPrimary, borderColor: palette.border }]}>
        <Ionicons color={palette.primary} name="phone-portrait-outline" size={20} />
        <View style={styles.noticeCopy}>
          <Text style={[styles.noticeTitle, { color: palette.text }]}>Local notifications only</Text>
          <Text style={[styles.body, { color: palette.mutedText }]}>Kiosk alerts appear here on this shared device. Push notifications and remote pings are not enabled.</Text>
        </View>
      </View>

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}

      <View style={[styles.segmentedControl, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <SegmentButton count={activeCount} label="Active" onPress={() => setView("active")} selected={view === "active"} />
        <SegmentButton count={resolvedCount} label="Resolved" onPress={() => setView("resolved")} selected={view === "resolved"} />
      </View>

      <View style={styles.scopeRow}>
        <ScopeButton label="All stalls" onPress={() => setScope("all")} selected={scope === "all"} />
        <ScopeButton label="Business-wide" onPress={() => setScope("business")} selected={scope === "business"} />
        <ScopeButton
          disabled={!status?.activeBranch}
          label={status?.activeBranch?.branchName ?? "No active stall"}
          onPress={() => setScope("activeStall")}
          selected={scope === "activeStall"}
        />
      </View>

      {loading ? <LoadingState label="Reading local alerts..." /> : null}

      {!loading && visibleAlerts.length === 0 ? (
        <Card>
          <EmptyState
            description={view === "active" ? "New same-device Kiosk alerts will appear here." : "Resolved alerts will remain available for local review."}
            title={view === "active" ? "No active alerts" : "No resolved alerts"}
          />
        </Card>
      ) : null}

      {!loading && visibleAlerts.length > 0 ? (
        <Card>
          <SectionHeader title={view === "active" ? "Needs review" : "Alert history"} />
          <View style={styles.alertList}>
            {visibleAlerts.map((alert) => (
              <View key={alert.id} style={[styles.alertCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <View style={styles.alertHeader}>
                  <View style={styles.alertTitleCopy}>
                    <Text style={[styles.alertTitle, { color: palette.text }]}>{alert.title}</Text>
                    <Text style={[styles.alertMeta, { color: palette.mutedText }]}>
                      {alert.branchId ? branchNames[alert.branchId] ?? "Saved stall" : "Business-wide"} · {formatSource(alert.source)}
                    </Text>
                  </View>
                  <Pill label={severityLabels[alert.severity]} tone={severityTones[alert.severity]} />
                </View>
                <Text style={[styles.body, { color: palette.mutedText }]}>{alert.message}</Text>
                <View style={styles.alertFooter}>
                  <Text style={[styles.alertTime, { color: palette.mutedText }]}>{formatAlertTime(alert.createdAt)}</Text>
                  {alert.status === "active" ? (
                    <Pressable
                      disabled={resolvingId !== null}
                      onPress={() => resolve(alert.id)}
                      style={[styles.resolveButton, { backgroundColor: palette.surface, borderColor: palette.border, opacity: resolvingId !== null ? 0.55 : 1 }]}
                    >
                      <Text style={[styles.resolveText, { color: palette.primary }]}>{resolvingId === alert.id ? "Resolving..." : "Resolve"}</Text>
                    </Pressable>
                  ) : (
                    <Pill label="Resolved" tone="success" />
                  )}
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

function SegmentButton({ label, count, selected, onPress }: { label: string; count: number; selected: boolean; onPress: () => void }) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, { backgroundColor: selected ? palette.primary : palette.surface }]}
    >
      <Text style={[styles.segmentText, { color: selected ? palette.kioskHeaderText : palette.mutedText }]}>{label}</Text>
      <View style={[styles.segmentCount, { backgroundColor: selected ? palette.softAccent : palette.softPrimary }]}>
        <Text style={[styles.segmentCountText, { color: selected ? palette.primary : palette.mutedText }]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function ScopeButton({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.scopeButton,
        {
          backgroundColor: selected ? palette.softPrimary : palette.surface,
          borderColor: selected ? palette.primary : palette.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.scopeText, { color: selected ? palette.primary : palette.mutedText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatAlertTime(value: string) {
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function formatSource(source: string) {
  return source === "kiosk_stock" ? "Kiosk Stock" : source.replaceAll("_", " ");
}

const styles = StyleSheet.create({
  headerButton: {
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
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
  segmentedControl: {
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: radius.sm,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  segmentCount: {
    alignItems: "center",
    borderRadius: radius.pill,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  segmentCountText: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
  },
  scopeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  scopeButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
  },
  scopeText: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  alertList: {
    gap: spacing.sm,
  },
  alertCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  alertHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  alertTitleCopy: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    ...typography.button,
  },
  alertMeta: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    textTransform: "capitalize",
  },
  alertFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  alertTime: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  resolveButton: {
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  resolveText: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
});
