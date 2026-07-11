import { Stack } from "expo-router";

import { OwnerAccessGate } from "@/components/owner/OwnerAccessGate";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";

export default function OwnerLayout() {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <OwnerAccessGate>
      <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.background },
        headerShown: false,
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.text,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Owner" }} />
      <Stack.Screen name="ask" options={{ title: "Local Helper" }} />
      <Stack.Screen name="records" options={{ title: "Logbook" }} />
      <Stack.Screen name="inventory" options={{ title: "Paninda" }} />
      <Stack.Screen name="grocery" options={{ title: "Grocery Stock" }} />
      <Stack.Screen name="recipes" options={{ title: "Recipe Cost" }} />
      <Stack.Screen name="production" options={{ title: "Niluto" }} />
      <Stack.Screen name="transfers" options={{ title: "Lipat" }} />
      <Stack.Screen name="fixed-costs" options={{ title: "Bayarin" }} />
      <Stack.Screen name="reports" options={{ title: "Kita Report" }} />
      <Stack.Screen name="pilot-guide" options={{ title: "Pilot Guide" }} />
      <Stack.Screen name="insights" options={{ title: "Insights" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </OwnerAccessGate>
  );
}
