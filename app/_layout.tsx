import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AppShell } from "@/components/common/AppShell";
import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";

export default function RootLayout() {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <AppShell>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} backgroundColor={palette.background} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: palette.background },
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="owner" options={{ headerShown: false }} />
        <Stack.Screen name="kiosk" options={{ headerShown: false }} />
      </Stack>
    </AppShell>
  );
}
