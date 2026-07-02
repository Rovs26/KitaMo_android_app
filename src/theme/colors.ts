export type ThemeMode = "light" | "dark" | "system";

export type ThemePalette = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  mutedText: string;
  success: string;
  warning: string;
  danger: string;
  kioskHeader: string;
  kioskHeaderText: string;
};

export const brandColors = {
  forestGreen: "#1F6B4A",
  warmGold: "#C69B2D",
  cream: "#F7F1E3",
  offWhite: "#FFFDF7",
  charcoal: "#18352B",
} as const;

export const themePalettes: Record<Exclude<ThemeMode, "system">, ThemePalette> = {
  light: {
    primary: brandColors.forestGreen,
    accent: brandColors.warmGold,
    background: brandColors.cream,
    surface: brandColors.offWhite,
    border: "#D8CCB0",
    text: brandColors.charcoal,
    mutedText: "#58645F",
    success: "#2E7D4F",
    warning: "#A86F00",
    danger: "#B23B3B",
    kioskHeader: brandColors.forestGreen,
    kioskHeaderText: brandColors.offWhite,
  },
  dark: {
    primary: "#76C69A",
    accent: "#E1B84E",
    background: "#101816",
    surface: "#18231F",
    border: "#30413A",
    text: "#F5F1E8",
    mutedText: "#B9C2BB",
    success: "#79C79D",
    warning: "#E2B957",
    danger: "#F08A8A",
    kioskHeader: "#0F3D2B",
    kioskHeaderText: "#FFFDF7",
  },
};
