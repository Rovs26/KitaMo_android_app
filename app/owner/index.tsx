import { PlaceholderScreen } from "@/components/common/PlaceholderScreen";

export default function OwnerHomeScreen() {
  return (
    <PlaceholderScreen
      title="Owner Home"
      description="Android Phase 1 foundation placeholder for the private owner cockpit."
      links={[
        { href: "/owner/ask", label: "Ask placeholder" },
        { href: "/owner/records", label: "Records placeholder" },
        { href: "/owner/inventory", label: "Inventory placeholder" },
        { href: "/owner/insights", label: "Insights placeholder" },
        { href: "/owner/settings", label: "Settings placeholder" },
        { href: "/kiosk", label: "Switch to Kiosk placeholder" },
      ]}
    />
  );
}
