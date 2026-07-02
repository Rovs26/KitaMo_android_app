import { create } from "zustand";

import type { ThemeMode } from "@/theme/colors";

type ThemeState = {
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  themeMode: "system",
  setThemeMode: (themeMode) => set({ themeMode }),
}));
