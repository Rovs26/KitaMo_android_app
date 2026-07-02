import { PlaceholderScreen } from "@/components/common/PlaceholderScreen";

export default function KioskHomeScreen() {
  return (
    <PlaceholderScreen
      title="Kiosk Mode"
      description="Android Phase 1 foundation placeholder for the selling counter."
      links={[
        { href: "/kiosk/sell", label: "Sell placeholder" },
        { href: "/kiosk/checkout", label: "Checkout placeholder" },
        { href: "/kiosk/orders", label: "Orders placeholder" },
        { href: "/kiosk/stock", label: "Stock placeholder" },
        { href: "/kiosk/shift", label: "Shift placeholder" },
        { href: "/owner", label: "Back to Owner placeholder" },
      ]}
    />
  );
}
