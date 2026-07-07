import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, MetricCard, Pill, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import {
  getLogbookDateGroup,
  listLogbookEvents,
  logbookDateGroupLabels,
  type LogbookDateGroup,
  type LogbookEvent,
  type LogbookEventFilter,
  type LogbookEventType,
} from "@/services/localAnalytics";
import { loadOwnerSetupStatus } from "@/services/ownerSetup";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

const filters: { id: LogbookEventFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "benta", label: "Benta" },
  { id: "grocery", label: "Grocery" },
  { id: "niluto", label: "Niluto" },
  { id: "bayarin", label: "Bayarin" },
  { id: "nasayang", label: "Nasayang" },
  { id: "lipat", label: "Lipat" },
];

const dateGroupOrder: LogbookDateGroup[] = ["today", "yesterday", "earlier"];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function eventTone(eventType: LogbookEventType): "primary" | "success" | "danger" | "neutral" | "warning" | "accent" {
  if (eventType === "benta") {
    return "success";
  }

  if (eventType === "grocery") {
    return "accent";
  }

  if (eventType === "niluto") {
    return "primary";
  }

  if (eventType === "bayarin") {
    return "warning";
  }

  if (eventType === "nasayang") {
    return "danger";
  }

  return "neutral";
}

export default function OwnerRecordsScreen() {
  const [events, setEvents] = useState<LogbookEvent[]>([]);
  const [activeFilter, setActiveFilter] = useState<LogbookEventFilter>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [summary, setSummary] = useState({ bentaTotal: 0, bentaCount: 0, eventCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const status = await loadOwnerSetupStatus();
      const nextEvents = await listLogbookEvents(status.activeBusiness?.id ?? null);
      const bentaEvents = nextEvents.filter((event) => event.eventType === "benta");
      setEvents(nextEvents);
      setSummary({
        bentaTotal: bentaEvents.reduce((total, event) => total + (event.amount ?? 0), 0),
        bentaCount: bentaEvents.length,
        eventCount: nextEvents.length,
      });
      setError(null);
    } catch (loadError) {
      logDevError("OwnerRecords.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load local records."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") {
      return events;
    }

    return events.filter((event) => event.eventType === activeFilter);
  }, [activeFilter, events]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<LogbookDateGroup, LogbookEvent[]>();
    for (const group of dateGroupOrder) {
      groups.set(group, []);
    }

    for (const event of filteredEvents) {
      const group = getLogbookDateGroup(event.happenedAt);
      groups.get(group)?.push(event);
    }

    return dateGroupOrder
      .map((group) => ({ group, events: groups.get(group) ?? [] }))
      .filter((entry) => entry.events.length > 0);
  }, [filteredEvents]);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  function changeFilter(filter: LogbookEventFilter) {
    setActiveFilter(filter);
    setSelectedEventId(null);
  }

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Timeline ng benta, grocery, niluto, bayarin, at iba pa." title="Logbook" />

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}

      <View style={styles.summaryGrid}>
        <MetricCard detail="All events" iconName="document-text-outline" label="Entries" tone="primary" value={String(summary.eventCount)} />
        <MetricCard detail="Benta records" iconName="cash-outline" label="Benta" tone="success" value={String(summary.bentaCount)} />
        <MetricCard detail="Total benta amount" iconName="wallet-outline" label="Benta total" tone="accent" value={formatPeso(summary.bentaTotal)} />
      </View>

      <SecondaryButton href="/owner/reports" label="Open Kita Report" />

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Money timeline</Text>
        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => changeFilter(filter.id)}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: active ? palette.primary : palette.surface,
                    borderColor: active ? palette.primary : palette.border,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: active ? palette.kioskHeaderText : palette.text }]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? <EmptyState description="Binabasa ang local logbook." title="Loading logbook" /> : null}

        {!loading && filteredEvents.length === 0 ? (
          <>
            <EmptyState description="Mag-start selling o mag-add ng grocery, niluto, o bayarin." title="Wala pang record sa filter na ito" />
            <SecondaryButton href="/kiosk" label="Start Selling" />
          </>
        ) : null}

        {groupedEvents.map(({ group, events: groupEvents }) => (
          <View key={group} style={styles.dateGroup}>
            <Text style={[styles.dateGroupTitle, { color: palette.mutedText }]}>{logbookDateGroupLabels[group]}</Text>
            {groupEvents.map((event) => (
              <LogbookEventCard
                event={event}
                key={event.id}
                onPress={() => setSelectedEventId((current) => (current === event.id ? null : event.id))}
                selected={selectedEventId === event.id}
              />
            ))}
          </View>
        ))}
      </Card>

      {selectedEvent?.receiptText ? (
        <Card>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptTitle}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Receipt</Text>
              <Text style={[styles.body, { color: palette.mutedText }]}>{selectedEvent.title}</Text>
            </View>
            <Pill label="Receipt" tone="success" />
          </View>
          <Text style={[styles.receiptText, { color: palette.text }]}>{selectedEvent.receiptText}</Text>
        </Card>
      ) : null}

      {selectedEvent && !selectedEvent.receiptText ? (
        <Card>
          <SectionDetail event={selectedEvent} />
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

function LogbookEventCard({
  event,
  selected,
  onPress,
}: {
  event: LogbookEvent;
  selected: boolean;
  onPress: () => void;
}) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.eventCard,
        {
          backgroundColor: selected ? palette.softPrimary : palette.background,
          borderColor: selected ? palette.primary : palette.border,
        },
      ]}
    >
      <View style={styles.eventTopRow}>
        <View style={styles.eventText}>
          <Text style={[styles.itemTitle, { color: palette.text }]}>{event.title}</Text>
          <Text style={[styles.body, { color: palette.mutedText }]}>{event.subtitle}</Text>
          <Text style={[styles.helper, { color: palette.mutedText }]}>{formatDateTime(event.happenedAt)}</Text>
        </View>
        {event.amount !== null ? (
          <Text style={[styles.eventAmount, { color: palette.primary }]}>{formatPeso(event.amount)}</Text>
        ) : null}
      </View>
      <View style={styles.eventMetaRow}>
        <Pill label={event.label} tone={eventTone(event.eventType)} />
        {event.receiptText ? <Text style={[styles.helper, { color: palette.mutedText }]}>Tap for receipt</Text> : null}
      </View>
    </Pressable>
  );
}

function SectionDetail({ event }: { event: LogbookEvent }) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.detailBlock}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{event.label} detail</Text>
      <Text style={[styles.body, { color: palette.text }]}>{event.title}</Text>
      <Text style={[styles.body, { color: palette.mutedText }]}>{event.subtitle}</Text>
      {event.amount !== null ? (
        <Text style={[styles.itemTitle, { color: palette.primary }]}>{formatPeso(event.amount)}</Text>
      ) : null}
      <Text style={[styles.helper, { color: palette.mutedText }]}>{formatDateTime(event.happenedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.body,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  dateGroup: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dateGroupTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  eventCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 12,
  },
  eventTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  eventText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    ...typography.button,
  },
  body: {
    ...typography.body,
  },
  helper: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  eventAmount: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23,
  },
  eventMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  receiptHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  receiptTitle: {
    flex: 1,
    gap: spacing.xs,
  },
  receiptText: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 18,
  },
  detailBlock: {
    gap: spacing.sm,
  },
});
