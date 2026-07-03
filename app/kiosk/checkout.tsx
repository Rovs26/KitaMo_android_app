import { Link } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { PaymentMethod } from "@/domain/types";
import { completeKioskSale, type CompletedKioskSale } from "@/services/kioskSales";
import { copyReceiptText, shareReceiptText } from "@/services/shareReceipt";
import { useKioskStore } from "@/state/kioskStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const paymentMethods: PaymentMethod[] = ["cash", "GCash", "Maya", "bank transfer", "other"];

function formatMoney(value: number) {
  return `PHP ${value.toFixed(2)}`;
}

function paymentLabel(method: PaymentMethod) {
  if (method === "bank transfer") {
    return "Bank transfer";
  }

  return method === "cash" || method === "other" ? method.charAt(0).toUpperCase() + method.slice(1) : method;
}

export default function KioskCheckoutScreen() {
  const cartItems = useKioskStore((state) => state.cartItems);
  const clearCart = useKioskStore((state) => state.clearCart);
  const setLastReceipt = useKioskStore((state) => state.setLastReceipt);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<CompletedKioskSale | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = parseMoney(discountAmount);
  const total = Math.max(0, subtotal - discount);
  const referenceRequired = paymentMethod !== "cash";

  async function confirmCheckout() {
    if (savingRef.current || saving || completedSale) {
      return;
    }

    if (cartItems.length === 0) {
      setMessage("Cart is empty.");
      return;
    }

    if (discount > subtotal) {
      setMessage("Discount cannot be greater than subtotal.");
      return;
    }

    if (referenceRequired && !referenceNumber.trim()) {
      setMessage(`${paymentLabel(paymentMethod)} needs a reference number before completing checkout.`);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setMessage("Saving local sale...");
    try {
      const sale = await completeKioskSale({
        cartItems,
        paymentMethod,
        externalReferenceNumber: referenceNumber.trim() || null,
        discountAmount: discount,
      });
      setCompletedSale(sale);
      setLastReceipt(sale.saleId, sale.receiptText);
      clearCart();
      setMessage("Sale completed locally.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete checkout.");
      savingRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  async function copyReceipt() {
    if (!completedSale) {
      return;
    }

    await copyReceiptText(completedSale.receiptText);
    setMessage("Receipt copied to clipboard.");
  }

  async function shareReceipt() {
    if (!completedSale) {
      return;
    }

    const shared = await shareReceiptText(completedSale.receiptText);
    setMessage(shared ? "Receipt shared." : "Sharing is not available on this device.");
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>Kiosk Checkout</Text>
        <Text style={[styles.title, { color: palette.text }]}>Complete sale</Text>
        <Text style={[styles.body, { color: palette.mutedText }]}>
          Sale, stock, receipt, and sync queue are saved together in one local transaction.
        </Text>
      </View>

      {message ? <Text style={[styles.message, { color: message.includes("Could not") || message.includes("cannot") ? palette.danger : palette.text }]}>{message}</Text> : null}

      {completedSale ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Receipt</Text>
          <Text style={[styles.receiptText, { color: palette.text }]}>{completedSale.receiptText}</Text>
          <View style={styles.inlineActions}>
            <SmallButton disabled={saving} label="Copy receipt" onPress={copyReceipt} />
            <SmallButton disabled={saving} label="Share receipt" onPress={shareReceipt} />
          </View>
          <View style={styles.inlineActions}>
            <Link href="/kiosk/sell" asChild>
              <Pressable style={[styles.secondaryAction, { borderColor: palette.border }]}>
                <Text style={[styles.secondaryActionText, { color: palette.primary }]}>Back to Sell</Text>
              </Pressable>
            </Link>
            <Link href="/kiosk/orders" asChild>
              <Pressable style={[styles.secondaryAction, { borderColor: palette.border }]}>
                <Text style={[styles.secondaryActionText, { color: palette.primary }]}>View Orders</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Cart Review</Text>
            {cartItems.length === 0 ? (
              <Text style={[styles.body, { color: palette.mutedText }]}>Cart is empty. Add products before checkout.</Text>
            ) : null}

            {cartItems.map((item) => (
              <View key={item.productId} style={[styles.cartRow, { borderColor: palette.border }]}>
                <View style={styles.cartText}>
                  <Text style={[styles.itemTitle, { color: palette.text }]}>{item.name}</Text>
                  <Text style={[styles.body, { color: palette.mutedText }]}>
                    {item.quantity} x {formatMoney(item.unitPrice)}
                  </Text>
                </View>
                <Text style={[styles.itemTotal, { color: palette.text }]}>{formatMoney(item.quantity * item.unitPrice)}</Text>
              </View>
            ))}

            <AmountRow label="Subtotal" value={subtotal} />
            <AmountRow label="Discount" value={discount} />
            <AmountRow strong label="Total" value={total} />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Payment</Text>
            <View style={styles.optionWrap}>
              {paymentMethods.map((method) => {
                const selected = method === paymentMethod;
                return (
                  <Pressable
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: selected ? palette.primary : palette.background,
                        borderColor: selected ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: selected ? palette.kioskHeaderText : palette.text }]}>
                      {paymentLabel(method)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <FormField
              editable={referenceRequired}
              label="Reference number"
              onChangeText={setReferenceNumber}
              placeholder={referenceRequired ? "Required for non-cash payment" : "Cash does not need a reference"}
              value={referenceNumber}
            />
            {referenceRequired ? (
              <Text style={[styles.body, { color: palette.warning }]}>Reference number is required for this payment method.</Text>
            ) : null}

            <FormField
              keyboardType="decimal-pad"
              label="Discount amount"
              onChangeText={setDiscountAmount}
              placeholder="Optional"
              value={discountAmount}
            />

            <Pressable
              disabled={saving || cartItems.length === 0}
              onPress={confirmCheckout}
              style={[styles.primaryAction, { backgroundColor: palette.primary, opacity: saving || cartItems.length === 0 ? 0.6 : 1 }]}
            >
              <Text style={[styles.primaryActionText, { color: palette.kioskHeaderText }]}>
                {saving ? "Saving..." : "Confirm Checkout"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function parseMoney(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type AmountRowProps = {
  label: string;
  value: number;
  strong?: boolean;
};

function AmountRow({ label, value, strong = false }: AmountRowProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.amountRow}>
      <Text style={[strong ? styles.totalLabel : styles.body, { color: palette.text }]}>{label}</Text>
      <Text style={[strong ? styles.totalLabel : styles.body, { color: palette.text }]}>{formatMoney(value)}</Text>
    </View>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
  editable?: boolean;
};

function FormField({ label, value, onChangeText, placeholder, keyboardType = "default", editable = true }: FormFieldProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        style={[
          styles.input,
          {
            backgroundColor: editable ? palette.background : palette.surface,
            borderColor: palette.border,
            color: palette.text,
            opacity: editable ? 1 : 0.6,
          },
        ]}
        value={value}
      />
    </View>
  );
}

type SmallButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

function SmallButton({ label, onPress, disabled = false }: SmallButtonProps) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.smallButton, { borderColor: palette.border, opacity: disabled ? 0.55 : 1 }]}
    >
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
  message: {
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
  cartRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.md,
  },
  cartText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    ...typography.button,
  },
  itemTotal: {
    ...typography.button,
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    ...typography.heading,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.button,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  secondaryAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
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
