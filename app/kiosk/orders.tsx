import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTopBar, Card, EmptyState, formatPeso, ListRow, ScreenScroll } from "@/components/ui/KitaMoUI";
import type { PaymentMethod } from "@/domain/types";
import { listRecentKioskOrders, type KioskOrderSummary } from "@/services/kioskSales";
import { copyReceiptText, shareReceiptText } from "@/services/shareReceipt";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getFriendlyErrorMessage, logDevError } from "@/utils/errors";

function formatMoney(value: number) {
  return formatPeso(value);
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextOrders = await listRecentKioskOrders();
      setOrders(nextOrders);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh().catch((error) => {
        logDevError("KioskOrders.refresh", error);
        if (active) {
          setMessage(getFriendlyErrorMessage("Could not load orders."));
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
    setMessage(shared ? "Share options opened." : "Sharing is not available on this device.");
  }

  return (
    <ScreenScroll>
      <AppTopBar subtitle="Recent sales and receipts." title="Orders" />

      {message ? <Text style={[styles.body, { color: palette.text }]}>{message}</Text> : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Orders</Text>
        {loading ? <EmptyState description="Reading local sales." title="Loading orders" /> : null}
        {!loading && orders.length === 0 ? (
          <EmptyState description="Kiosk sales will appear here after checkout." title="No local sales yet" />
        ) : null}

        {orders.map((order) => (
          <ListRow
            amount={formatMoney(order.amount)}
            badge={paymentLabel(order.paymentMethod)}
            badgeTone="success"
            icon="B"
            key={order.id}
            onPress={() => setSelectedOrder(order)}
            subtitle={`${formatDateTime(order.happenedAt)} · ${order.itemCount} item(s)${
              order.externalReferenceNumber ? ` · Ref ${order.externalReferenceNumber}` : ""
            }`}
            title={order.transactionNo}
          />
        ))}
      </Card>

      {selectedOrder ? (
        <Card>
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
        </Card>
      ) : null}
    </ScreenScroll>
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
