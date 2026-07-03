import { PlaceholderScreen } from "@/components/common/PlaceholderScreen";

export default function OwnerAskScreen() {
  return (
    <PlaceholderScreen
      title="Ask"
      description="Ask KitaMo is coming soon for this Android pilot."
      emptyTitle="Ask KitaMo is coming soon"
      previewCards={[
        { title: "Draft review", description: "Future local drafts can be checked before saving.", icon: "D" },
        { title: "Receipt help", description: "Photo and OCR work stays deferred for now.", icon: "R" },
      ]}
    />
  );
}
