import { PlaceholderScreen } from "@/components/common/PlaceholderScreen";

export default function OwnerInsightsScreen() {
  return (
    <PlaceholderScreen
      title="Insights"
      description="Insights will appear after more local sales data."
      emptyTitle="Insights are coming soon"
      previewCards={[
        { title: "Best sellers", description: "Top products will appear after more Kiosk sales.", icon: "B" },
        { title: "Low stock trend", description: "Stock risk will use saved local inventory movements.", icon: "L" },
        { title: "Daily sales", description: "Simple day-by-day sales will come after pilot records grow.", icon: "D" },
      ]}
    />
  );
}
