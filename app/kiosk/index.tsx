import { Redirect } from "expo-router";

// Sell is the default Kiosk screen. Opening Kiosk goes straight to the products
// so the seller can tap-and-sell without extra taps. The persistent kiosk nav
// bar (Sell / Orders / Stock / Shift) lives on each kiosk screen.
export default function KioskIndexScreen() {
  return <Redirect href="/kiosk/sell" />;
}
