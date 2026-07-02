import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { PaymentMethod } from "@/domain/types";
import { listRecentKioskOrders, type KioskOrderSummary } from "@/services/kioskSales";
import { copyReceiptText, shareReceiptText } from "@/services/shareReceipt";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

function formatMoney(value: number) {
  return `PHP ${value.toFixed(2)}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function paymentLabel(method: PaymentMethod) {
  return method === "bank transfer" ? "Bank transfer" : method === "cash" || method === "other" ? method.charAt(0).toUpperCase() + method.slice(1) : method;
}

export default function KioskOrdersScreen() {
  const [orders, setOrders] = useState<KioskOrderSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<KioskOrderSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    const nextOrders = await listRecentKioskOrders();
    setOrders(nextOrders);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh().catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Could not load orders.");
        }
      });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  async function copyReceipt() {
    if (!selectedOrder?.receiptText) {
      return;
    }

    await copyReceiptText(selectedOrder.receiptText);
    setMessage("Receipt copied to clipboard.");
  }

  async function shareReceipt() {
    if (!selectedOrder?.receiptText) {
      return;
    }

    const shared = await shareReceiptText(selectedOrder.receiptText);
    setMessage(shared ? "Receipt shared." : "Sharing is not available on this device.");
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>Kiosk Orders</Text>
        <Text style={[styles.title, { color: palette.text }]}>Recent local sales</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>Sales saved on this device appear here immediately.</Text>
      </View>

      {message ? <Text style={[styles.body, { color: palette.text }]}>{message}</Text> : null}

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Orders</Text>
        {orders.length === 0 ? <Text style={[styles.body, { color: palette.mutedText }]}>No local sales yet.</Text> : null}

        {orders.map((order) => (
          <Pressable
            key={order.id}
            onPress={() => setSelectedOrder(order)}
            style={[styles.orderRow, { borderColor: palette.border }]}
          >
            <View style={styles.orderText}>
              <Text style={[styles.orderTitle, { color: palette.text }]}>{order.transactionNo}</Text>
              <Text style={[styles.body, { color: palette.mutedText }]}>
                {formatDateTime(order.happenedAt)} | {order.itemCount} item(s)
              </Text>
              <Text style={[styles.body, { color: palette.mutedText }]}>
                {paymentLabel(order.paymentMethod)}
                {order.externalReferenceNumber ? ` | Ref ${order.externalReferenceNumber}` : ""}
              </Text>
            </View>
            <Text style={[styles.orderAmount, { color: palette.text }]}>{formatMoney(order.amount)}</Text>
          </Pressable>
        ))}
      </View>

      {selectedOrder ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Receipt Details</Text>
          <Text style={[styles.body, { color: palette.mutedText }]}>{selectedOrder.transactionNo}</Text>
          {selectedOrder.receiptText ? (
            <>
              <Text style={[styles.receiptText, { color: palette.text }]}>{selectedOrder.receiptText}</Text>
              <View style={styles.inlineActions}>
                <SmallButton label="Copy receipt" onPress={copyReceipt} />
                <SmallButton label="Share receipt" onPress={shareReceipt} />
              </View>
            </>
          ) : (
            <Text style={[styles.body, { color: palette.mutedText }]}>No receipt text saved for this order.</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

type SmallButtonProps = {
  label: string;
  onPress: () => void;
};

function SmallButton({ label, onPress }: SmallButtonProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable onPress={onPress} style={[styles.smallButton, { borderColor: palette.border }]}>
      <Text style={[styles.smallButtonText, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.label,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
  },
  orderRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.md,
  },
  orderText: {
    flex: 1,
    gap: spacing.xs,
  },
  orderTitle: {
    ...typography.button,
  },
  orderAmount: {
    ...typography.button,
  },
  receiptText: {
    fontFamily: "monospace",
    fontSize: 14,
    lineHeight: 20,
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  smallButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
});
