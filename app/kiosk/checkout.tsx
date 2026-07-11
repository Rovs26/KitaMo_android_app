import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar, Card, formatPeso, IconBadge, PrimaryButton, ScreenScroll, SecondaryButton } from "@/components/ui/KitaMoUI";
import { calculateCartSubtotal, calculateLineTotal } from "@/domain/pricing";
import type { PaymentMethod } from "@/domain/types";
import { completeKioskSale, type CompletedKioskSale } from "@/services/kioskSales";
import { copyReceiptText, shareReceiptText } from "@/services/shareReceipt";
import { useKioskStore } from "@/state/kioskStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { getUserSafeErrorMessage, logDevError } from "@/utils/errors";

const paymentMethods: PaymentMethod[] = ["cash", "GCash", "Maya", "bank transfer", "other"];

function formatMoney(value: number) {
  return formatPeso(value);
}

function paymentLabel(method: PaymentMethod) {
  if (method === "bank transfer") {
    return "Bank transfer";
  }

  return method === "cash" || method === "other" ? method.charAt(0).toUpperCase() + method.slice(1) : method;
}

export default function KioskCheckoutScreen() {
  const cartItems = useKioskStore((state) => state.cartItems);
  const checkoutToken = useKioskStore((state) => state.checkoutToken);
  const clearCart = useKioskStore((state) => state.clearCart);
  const setLastReceipt = useKioskStore((state) => state.setLastReceipt);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedKioskSale | null>(null);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  function setNotice(text: string) {
    setMessage(text);
    setMessageIsError(false);
  }

  function setError(text: string) {
    setMessage(text);
    setMessageIsError(true);
  }

  const router = useRouter();
  const subtotal = calculateCartSubtotal(cartItems);
  const discount = parseMoney(discountAmount);
  const discountInvalid = discount === null;
  const total = Math.max(0, subtotal - (discount ?? 0));
  const referenceRequired = paymentMethod !== "cash";

  async function confirmCheckout() {
    if (savingRef.current || saving || completedSale) {
      return;
    }

    if (cartItems.length === 0) {
      setError("Cart is empty.");
      return;
    }

    if (discount === null) {
      setError("Discount should be a number, like 10 or 12.50.");
      return;
    }

    if (discount > subtotal) {
      setError("Discount cannot be greater than subtotal.");
      return;
    }

    if (referenceRequired && !referenceNumber.trim()) {
      setError(`${paymentLabel(paymentMethod)} needs a reference number before completing checkout.`);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setNotice("Saving local sale...");
    try {
      const sale = await completeKioskSale({
        cartItems,
        checkoutToken,
        paymentMethod,
        externalReferenceNumber: referenceRequired ? referenceNumber.trim() || null : null,
        discountAmount: discount,
      });
      setCompletedSale(sale);
      setLastReceipt(sale.saleId, sale.receiptText);
      clearCart();
      setNotice("Sale completed. Saved locally on this device.");
    } catch (error) {
      logDevError("KioskCheckout.confirmCheckout", error);
      setError(getUserSafeErrorMessage(error, "Could not complete checkout."));
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
    setNotice("Receipt copied to clipboard.");
  }

  async function shareReceipt() {
    if (!completedSale) {
      return;
    }

    const shared = await shareReceiptText(completedSale.receiptText);
    if (shared) {
      setNotice("Share options opened.");
    } else {
      setError("Sharing is not available on this device.");
    }
  }

  return (
    <ScreenScroll kioskNav>
      <AppTopBar subtitle="Review payment and save the receipt." title="Complete sale" />

      {message ? <Text style={[styles.message, { color: messageIsError ? palette.danger : palette.text }]}>{message}</Text> : null}

      {completedSale ? (
        <>
          <Card>
            <View style={styles.receiptHeader}>
              <IconBadge icon="receipt-outline" tone="success" />
              <View style={styles.receiptTitleWrap}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Receipt</Text>
                <Text style={[styles.body, { color: palette.mutedText }]}>{completedSale.transactionNo}</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => router.replace("/kiosk/sell")}>
                <Text style={[styles.editLink, { color: palette.primary }]}>Close</Text>
              </Pressable>
            </View>
            <View style={[styles.totalCard, { backgroundColor: palette.softPrimary, borderColor: palette.border }]}>
              <Text style={[styles.body, { color: palette.mutedText }]}>Total paid</Text>
              <Text style={[styles.totalAmount, { color: palette.primary }]}>{formatMoney(completedSale.total)}</Text>
            </View>
            <Text style={[styles.receiptText, { color: palette.text }]}>{completedSale.receiptText}</Text>
            <View style={styles.inlineActions}>
              <SmallButton disabled={saving} label="Copy receipt" onPress={copyReceipt} />
              <SmallButton disabled={saving} label="Share receipt" onPress={shareReceipt} />
            </View>
          </Card>

          <PrimaryButton label="Bagong benta" onPress={() => router.replace("/kiosk/sell")} />
          <SecondaryButton href="/kiosk/orders" label="Tingnan ang Orders" />
        </>
      ) : (
        <>
          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Cart Review</Text>
            {cartItems.length === 0 ? (
              <Text style={[styles.body, { color: palette.mutedText }]}>Cart is empty. Add products before checkout.</Text>
            ) : null}

            {cartItems.map((item) => {
              const pricing = calculateLineTotal(item);
              return (
                <View key={item.productId} style={[styles.cartRow, { borderColor: palette.border }]}>
                  <View style={styles.cartText}>
                    <Text style={[styles.itemTitle, { color: palette.text }]}>{item.name}</Text>
                    <Text style={[styles.body, { color: palette.mutedText }]}>
                      {item.quantity} x {formatMoney(item.unitPrice)}
                    </Text>
                    {pricing.bundleApplied && pricing.displayLabel ? (
                      <Text style={[styles.bundleApplied, { color: palette.warning }]}>Bundle applied: {pricing.displayLabel}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.itemTotal, { color: palette.text }]}>{formatMoney(pricing.lineTotal)}</Text>
                </View>
              );
            })}

            <AmountRow label="Subtotal" value={subtotal} />
            <AmountRow label="Discount" value={discount ?? 0} />
            <AmountRow strong label="Total" value={total} />
          </Card>

          <Card>
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
            {discountInvalid ? (
              <Text style={[styles.body, { color: palette.danger }]}>Discount should be a number, like 10 or 12.50.</Text>
            ) : null}

            <PrimaryButton disabled={saving || cartItems.length === 0} label={saving ? "Saving..." : "Confirm Checkout"} onPress={confirmCheckout} />
          </Card>
        </>
      )}
    </ScreenScroll>
  );
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  if (trimmed.includes(",")) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
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
  bundleApplied: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
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
    gap: 12,
    justifyContent: "space-between",
    paddingTop: 10,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
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
    fontSize: 13,
    lineHeight: 18,
  },
  receiptHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  receiptTitleWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  totalCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: 12,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  editLink: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
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
