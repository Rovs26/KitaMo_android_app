import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";

/**
 * App-level shell. Provides safe-area insets to every screen; the actual top
 * and bottom padding is applied per-screen by ScreenScroll so scroll content
 * and the bottom navigation can each respect the Android status bar and
 * gesture/navigation area independently.
 */
export function AppShell({ children }: PropsWithChildren) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return (
    <SafeAreaProvider>
      <View style={[styles.container, { backgroundColor: palette.background }]}>{children}</View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
