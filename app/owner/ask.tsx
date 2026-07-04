import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, ScreenScroll } from "@/components/ui/KitaMoUI";
import { getLocalAnalyticsSnapshot, type LocalAnalyticsSnapshot } from "@/services/localAnalytics";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

type SuggestedQuestion = {
  id: string;
  label: string;
};

const suggestedQuestions: SuggestedQuestion[] = [
  { id: "today-sales", label: "Magkano ang benta today?" },
  { id: "pending-saves", label: "Ilan ang pending saves?" },
  { id: "low-stock", label: "Ano ang low stock?" },
  { id: "top-product", label: "Ano ang top product?" },
  { id: "sales-today", label: "May sales ba today?" },
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
      return "For now, I can answer simple local questions only. Full Lis AI will come later.";
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

  return "For now, I can answer simple local questions only. Full Lis AI will come later.";
}

export default function OwnerAskScreen() {
  const [snapshot, setSnapshot] = useState<LocalAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [answer, setAnswer] = useState("Tap a question to ask about your local records.");
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
      <AppTopBar subtitle="Ask simple questions about your local sales, stock, and records." title="Ask KitaMo" />

      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Suggested questions</Text>
        <View style={styles.questionGrid}>
          {suggestedQuestions.map((question) => (
            <Pressable
              key={question.id}
              onPress={() => askSuggestion(question)}
              style={[styles.questionButton, { backgroundColor: palette.background, borderColor: palette.border }]}
            >
              <Text style={[styles.questionText, { color: palette.text }]}>{question.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Ask a local question</Text>
        <TextInput
          onChangeText={setQuestionText}
          onSubmitEditing={askTypedQuestion}
          placeholder="Example: May sales ba today?"
          placeholderTextColor={palette.mutedText}
          returnKeyType="send"
          style={[styles.input, { backgroundColor: palette.background, borderColor: palette.border, color: palette.text }]}
          value={questionText}
        />
        <Pressable onPress={askTypedQuestion} style={[styles.askButton, { backgroundColor: palette.primary }]}>
          <Text style={[styles.askButtonText, { color: palette.kioskHeaderText }]}>Ask</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Answer</Text>
        {loading ? (
          <EmptyState description="Reading your local records." title="Checking local data" />
        ) : (
          <Text style={[styles.answerText, { color: palette.text }]}>{answer}</Text>
        )}
      </Card>

      {quickFacts.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Local facts</Text>
          <View style={styles.factGrid}>
            {quickFacts.map((fact) => (
              <View key={fact.label} style={[styles.factCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Text style={[styles.factLabel, { color: palette.mutedText }]}>{fact.label}</Text>
                <Text style={[styles.factValue, { color: palette.primary }]}>{fact.value}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.body,
  },
  sectionTitle: {
    ...typography.heading,
  },
  questionGrid: {
    gap: spacing.sm,
  },
  questionButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  questionText: {
    ...typography.button,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
  },
  askButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  askButtonText: {
    ...typography.button,
  },
  answerText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
  },
  factGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  factCard: {
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: spacing.xs,
    padding: 12,
  },
  factLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  factValue: {
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
  },
});
