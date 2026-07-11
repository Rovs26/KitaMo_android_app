import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, formatPeso, ScreenScroll } from "@/components/ui/KitaMoUI";
import { getLocalAnalyticsSnapshot, type LocalAnalyticsSnapshot } from "@/services/localAnalytics";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

type SuggestedQuestion = {
  id: string;
  label: string;
  chip: string;
};

const suggestedQuestions: SuggestedQuestion[] = [
  { id: "today-sales", label: "Magkano ang benta today?", chip: "Benta today" },
  { id: "pending-saves", label: "Ilan ang pending saves?", chip: "Pending saves" },
  { id: "low-stock", label: "Ano ang low stock?", chip: "Low stock" },
  { id: "top-product", label: "Ano ang top product?", chip: "Top product" },
  { id: "sales-today", label: "May sales ba today?", chip: "May benta?" },
];

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function answerSuggestedQuestion(questionId: string, snapshot: LocalAnalyticsSnapshot | null) {
  if (!snapshot?.hasBusiness) {
    return "Set up your business profile first so Ask KitaMo can read your local records.";
  }

  switch (questionId) {
    case "today-sales":
      return `Today's benta is ${formatPeso(snapshot.today.salesTotal)} from ${formatCount(snapshot.today.transactionCount, "transaction")}.`;
    case "pending-saves":
      return snapshot.pendingQueueCount > 0
        ? `You have ${formatCount(snapshot.pendingQueueCount, "pending save")} waiting on this device. Cloud sync is not active yet.`
        : "Wala kang pending saves right now.";
    case "low-stock": {
      if (snapshot.lowStock.lowStockCount === 0) {
        return "Walang low-stock item based on your saved product thresholds.";
      }

      const names = snapshot.lowStock.products.slice(0, 4).map((product) => product.name).join(", ");
      const extra = snapshot.lowStock.lowStockCount > 4 ? ` and ${snapshot.lowStock.lowStockCount - 4} more` : "";
      return `Low stock: ${names}${extra}. Review Inventory before selling more.`;
    }
    case "top-product":
      return snapshot.topProductByQuantity
        ? `Top product so far is ${snapshot.topProductByQuantity.name}: ${snapshot.topProductByQuantity.quantitySold} sold, ${formatPeso(snapshot.topProductByQuantity.salesAmount)} sales.`
        : "Wala pang top product. Save a Kiosk sale first.";
    case "sales-today":
      return snapshot.today.transactionCount > 0
        ? `Yes. You have ${formatCount(snapshot.today.transactionCount, "sale")} today worth ${formatPeso(snapshot.today.salesTotal)}.`
        : "Wala pang benta today. Start selling in Kiosk when ready.";
    default:
      return "Simple questions lang muna ang kaya ko, galing sa records ng phone na ito.";
  }
}

function answerTypedQuestion(question: string, snapshot: LocalAnalyticsSnapshot | null) {
  const text = question.trim().toLowerCase();

  if (!text) {
    return "Type a simple local question or tap one of the suggestions.";
  }

  if (text.includes("pending")) {
    return answerSuggestedQuestion("pending-saves", snapshot);
  }

  if (text.includes("low") || text.includes("stock") || text.includes("paubos")) {
    return answerSuggestedQuestion("low-stock", snapshot);
  }

  if (text.includes("top") || text.includes("mabenta") || text.includes("product")) {
    return answerSuggestedQuestion("top-product", snapshot);
  }

  if (text.includes("today") || text.includes("benta") || text.includes("sales") || text.includes("kita")) {
    return answerSuggestedQuestion("today-sales", snapshot);
  }

  return "Simple questions lang muna ang kaya ko, galing sa records ng phone na ito.";
}

export default function OwnerAskScreen() {
  const [snapshot, setSnapshot] = useState<LocalAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [answer, setAnswer] = useState("Tap a question to check your local records.");
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const quickFacts = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      { label: "Today", value: formatPeso(snapshot.today.salesTotal) },
      { label: "Transactions", value: String(snapshot.today.transactionCount) },
      { label: "Pending", value: String(snapshot.pendingQueueCount) },
      { label: "Low stock", value: String(snapshot.lowStock.lowStockCount) },
    ];
  }, [snapshot]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextSnapshot = await getLocalAnalyticsSnapshot("today");
      setSnapshot(nextSnapshot);
      setError(null);
    } catch (loadError) {
      logDevError("OwnerAsk.refresh", loadError);
      setError(getFriendlyErrorMessage("Could not load local answers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  function askSuggestion(question: SuggestedQuestion) {
    setQuestionText(question.label);
    setAnswer(answerSuggestedQuestion(question.id, snapshot));
  }

  function askTypedQuestion() {
    setAnswer(answerTypedQuestion(questionText, snapshot));
  }

  return (
    <ScreenScroll bottomNav>
      <AppTopBar subtitle="Quick answers from this phone's records." title="Local Helper" />

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}

      <Text style={[styles.notice, { color: palette.mutedText }]}>Local only — walang AI sa pilot.</Text>

      <View style={styles.assistantRow}>
        <View style={[styles.avatar, { backgroundColor: palette.softPrimary }]}>
          <Ionicons color={palette.primary} name="chatbubble-ellipses" size={18} />
        </View>
        <View style={[styles.assistantBubble, { backgroundColor: palette.surface }]}>
          <Text style={[styles.bubbleText, { color: palette.text }]}>
            Hi, ako si KitaMo Helper. Tanungin mo ang local records ng phone na ito.
          </Text>
        </View>
      </View>

      <View style={styles.assistantRow}>
        <View style={[styles.avatar, { backgroundColor: palette.softPrimary }]}>
          <Ionicons color={palette.primary} name="chatbubble-ellipses" size={18} />
        </View>
        <View style={[styles.assistantBubble, { backgroundColor: palette.surface }]}>
          <Text style={[styles.bubbleText, { color: palette.text }]}>
            {loading ? "Binabasa ang local records..." : answer}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {suggestedQuestions.map((question) => (
          <Pressable
            key={question.id}
            onPress={() => askSuggestion(question)}
            style={[styles.chip, { backgroundColor: palette.softPrimary, borderColor: palette.border }]}
          >
            <Text style={[styles.chipText, { color: palette.primary }]}>{question.chip}</Text>
          </Pressable>
        ))}
      </View>

      {quickFacts.length > 0 ? (
        <View style={styles.factRow}>
          {quickFacts.map((fact) => (
            <View key={fact.label} style={[styles.factCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.factLabel, { color: palette.mutedText }]}>{fact.label}</Text>
              <Text style={[styles.factValue, { color: palette.primary }]}>{fact.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.inputRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <TextInput
          onChangeText={setQuestionText}
          onSubmitEditing={askTypedQuestion}
          placeholder="I-type ang tanong…"
          placeholderTextColor={palette.mutedText}
          returnKeyType="send"
          style={[styles.chatInput, { color: palette.text }]}
          value={questionText}
        />
        <Pressable onPress={askTypedQuestion} style={[styles.sendButton, { backgroundColor: palette.primary }]}>
          <Ionicons color={palette.kioskHeaderText} name="send" size={18} />
        </Pressable>
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.body,
  },
  notice: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  assistantRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm,
  },
  avatar: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderRadius: radius.lg,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...shadows.card,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 21,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  factRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  factCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    gap: 2,
    padding: spacing.sm + 2,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  factValue: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
  },
  inputRow: {
    alignItems: "center",
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
});
