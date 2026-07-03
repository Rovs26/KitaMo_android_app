import { PlaceholderScreen } from "@/components/common/PlaceholderScreen";

export default function OwnerRecordsScreen() {
  return (
    <PlaceholderScreen
      title="Records"
      description="Local owner records will appear here after more Android pilot activity."
      emptyTitle="Records are being prepared"
      links={[{ href: "/kiosk/orders", label: "View Kiosk Orders" }, { href: "/owner", label: "Back to Home" }]}
      previewCards={[
        { title: "Sales records", description: "Completed Kiosk sales are already saved locally.", icon: "S" },
        { title: "Inventory movement", description: "Stock changes stay visible in Kiosk and Inventory for now.", icon: "I" },
      ]}
    />
  );
}
