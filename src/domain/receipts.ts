import type { PaymentMethod } from "./types";

export type ReceiptLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  bundleApplied?: boolean;
  bundleLabel?: string | null;
};

export type ReceiptTextInput = {
  businessName: string;
  branchName: string;
  saleId: string;
  transactionNo: string;
  happenedAt: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  externalReferenceNumber: string | null;
};

function formatMoney(value: number) {
  return `PHP ${value.toFixed(2)}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function paymentLabel(paymentMethod: PaymentMethod) {
  if (paymentMethod === "GCash") {
    return "GCash";
  }

  if (paymentMethod === "Maya") {
    return "Maya";
  }

  if (paymentMethod === "bank transfer") {
    return "Bank transfer";
  }

  return paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);
}

export function buildReceiptText(input: ReceiptTextInput) {
  const lines = [
    input.businessName,
    input.branchName,
    `Receipt: ${input.transactionNo}`,
    `Sale ID: ${input.saleId}`,
    `Date: ${formatDateTime(input.happenedAt)}`,
    "",
    "Items",
    ...input.items.flatMap((item) => {
      const itemLines = [`${item.name} x ${item.quantity} @ ${formatMoney(item.unitPrice)} = ${formatMoney(item.lineTotal)}`];
      if (item.bundleApplied && item.bundleLabel) {
        itemLines.push(`  Bundle: ${item.bundleLabel}`);
      }
      return itemLines;
    }),
    "",
    `Subtotal: ${formatMoney(input.subtotal)}`,
  ];

  if (input.discount > 0) {
    lines.push(`Discount: ${formatMoney(input.discount)}`);
  }

  lines.push(
    `Total: ${formatMoney(input.total)}`,
    `Payment: ${paymentLabel(input.paymentMethod)}`,
  );

  if (input.externalReferenceNumber) {
    lines.push(`Reference: ${input.externalReferenceNumber}`);
  }

  lines.push("", "Stored locally on this device. Sync is not connected yet.", "Salamat po!");

  return lines.join("\n");
}
