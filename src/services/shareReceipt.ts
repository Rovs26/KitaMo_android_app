import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";

export async function copyReceiptText(receiptText: string) {
  await Clipboard.setStringAsync(receiptText);
}

export async function canUseNativeShare() {
  return Sharing.isAvailableAsync();
}
