export type ThemeMode = "light" | "dark" | "system";

export type ThemePalette = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  mutedText: string;
  softPrimary: string;
  softAccent: string;
  softDanger: string;
  softSuccess: string;
  softWarning: string;
  success: string;
  warning: string;
  danger: string;
  kioskHeader: string;
  kioskHeaderText: string;
};

export const brandColors = {
  forestGreen: "#166534",
  warmGold: "#D59A17",
  cream: "#F8FAF4",
  offWhite: "#FFFFFF",
  charcoal: "#17231D",
} as const;

export const themePalettes: Record<Exclude<ThemeMode, "system">, ThemePalette> = {
  light: {
    primary: brandColors.forestGreen,
    accent: brandColors.warmGold,
    background: brandColors.cream,
    surface: brandColors.offWhite,
    border: "#D9E2D0",
    text: brandColors.charcoal,
    mutedText: "#667085",
    softPrimary: "#ECFDF5",
    softAccent: "#FEF3C7",
    softDanger: "#FEF2F2",
    softSuccess: "#ECFDF5",
    softWarning: "#FFFBEB",
    success: "#166534",
    warning: "#B45309",
    danger: "#B42318",
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
    softPrimary: "#1E352C",
    softAccent: "#362D16",
    softDanger: "#3A2020",
    softSuccess: "#1F352B",
    softWarning: "#342B17",
    success: "#79C79D",
    warning: "#E2B957",
    danger: "#F08A8A",
    kioskHeader: "#0F3D2B",
    kioskHeaderText: "#FFFDF7",
  },
};
