import { Stack } from "expo-router";

import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";

export default function OwnerLayout() {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
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
      <Stack.Screen name="records" options={{ title: "Records" }} />
      <Stack.Screen name="inventory" options={{ title: "Inventory" }} />
      <Stack.Screen name="grocery" options={{ title: "Grocery Pool" }} />
      <Stack.Screen name="recipes" options={{ title: "Recipes" }} />
      <Stack.Screen name="production" options={{ title: "Production" }} />
      <Stack.Screen name="transfers" options={{ title: "Transfers" }} />
      <Stack.Screen name="fixed-costs" options={{ title: "Fixed Costs" }} />
      <Stack.Screen name="reports" options={{ title: "Profit Reports" }} />
      <Stack.Screen name="pilot-guide" options={{ title: "Pilot Guide" }} />
      <Stack.Screen name="insights" options={{ title: "Insights" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
