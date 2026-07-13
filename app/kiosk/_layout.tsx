import { Redirect, Stack, usePathname } from "expo-router";
import { useEffect } from "react";

import { useOwnerAccessStore } from "@/state/ownerAccessStore";
import { useAppStore } from "@/state/appStore";

export default function KioskLayout() {
  const lockOwnerAccess = useOwnerAccessStore((state) => state.lock);
  const activeBusinessId = useAppStore((state) => state.activeBusinessId);
  const activeBranchId = useAppStore((state) => state.activeBranchId);
  const kioskSessionBranchId = useAppStore((state) => state.kioskSessionBranchId);
  const pathname = usePathname();

  useEffect(() => {
    lockOwnerAccess();
  }, [lockOwnerAccess]);

  if (
    pathname !== "/kiosk" &&
    (!activeBusinessId || !activeBranchId || !kioskSessionBranchId || activeBranchId !== kioskSessionBranchId)
  ) {
    return <Redirect href="/kiosk" />;
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "transparent" },
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Kiosk" }} />
      <Stack.Screen name="sell" options={{ title: "Sell" }} />
      <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
      <Stack.Screen name="orders" options={{ title: "Orders" }} />
      <Stack.Screen name="stock" options={{ title: "Stock" }} />
      <Stack.Screen name="shift" options={{ title: "Shift" }} />
    </Stack>
  );
}
