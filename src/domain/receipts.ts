export type ReceiptTextInput = {
  businessName: string;
  transactionNo: string;
};

export function buildPlaceholderReceiptText(input: ReceiptTextInput) {
  return `${input.businessName}\nReceipt ${input.transactionNo}\nAndroid Phase 1 placeholder receipt.`;
}
