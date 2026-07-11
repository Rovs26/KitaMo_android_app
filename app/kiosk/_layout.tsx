import { Stack } from "expo-router";
import { useEffect } from "react";

import { useOwnerAccessStore } from "@/state/ownerAccessStore";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";

export default function KioskLayout() {
  const lockOwnerAccess = useOwnerAccessStore((state) => state.lock);
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  useEffect(() => {
    lockOwnerAccess();
  }, [lockOwnerAccess]);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.background },
        headerShown: false,
        headerStyle: { backgroundColor: palette.kioskHeader },
        headerTintColor: palette.kioskHeaderText,
        headerTitleStyle: { fontWeight: "700" },
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
