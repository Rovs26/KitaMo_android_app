import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";

export async function copyReceiptText(receiptText: string) {
  await Clipboard.setStringAsync(receiptText);
}

export async function canUseNativeShare() {
  return Sharing.isAvailableAsync();
}

export async function shareReceiptText(receiptText: string) {
  const available = await canUseNativeShare();
  if (!available) {
    return false;
  }

  await Share.share({ message: receiptText });
  return true;
}
