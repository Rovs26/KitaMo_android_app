import { Platform } from "react-native";

/**
 * Soft elevation tokens. iOS uses shadow*, Android uses elevation; each token
 * sets both so cards look consistent cross-platform. Cards use `card`; the
 * Today's Money hero uses the slightly stronger `hero`.
 */
export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#0B1F17",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    default: { elevation: 2 },
  }),
  hero: Platform.select({
    ios: {
      shadowColor: "#0B1F17",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
    },
    default: { elevation: 5 },
  }),
} as const;
