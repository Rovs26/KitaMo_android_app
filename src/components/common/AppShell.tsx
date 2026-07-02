import { PropsWithChildren } from "react";
import { SafeAreaView, StyleSheet } from "react-native";

import { useThemeStore } from "@/state/themeStore";
import { themePalettes } from "@/theme/colors";

export function AppShell({ children }: PropsWithChildren) {
  const themeMode = useThemeStore((state) => state.themeMode);
  const palette = themePalettes[themeMode === "dark" ? "dark" : "light"];

  return <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
