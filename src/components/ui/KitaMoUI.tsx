import { Link, type Href, usePathname } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";

import { useThemeStore } from "@/state/themeStore";
import { themePalettes, type ThemePalette } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type Tone = "primary" | "accent" | "success" | "warning" | "danger" | "neutral";

const toneStyles = {
  primary: (palette: ThemePalette) => ({ backgroundColor: palette.softPrimary, color: palette.primary, borderColor: palette.border }),
  accent: (palette: ThemePalette) => ({ backgroundColor: palette.softAccent, color: palette.accent, borderColor: palette.border }),
  success: (palette: ThemePalette) => ({ backgroundColor: palette.softSuccess, color: palette.success, borderColor: palette.border }),
  warning: (palette: ThemePalette) => ({ backgroundColor: palette.softWarning, color: palette.warning, borderColor: "#F0D8A7" }),
  danger: (palette: ThemePalette) => ({ backgroundColor: palette.softDanger, color: palette.danger, borderColor: "#F2C8BD" }),
  neutral: (palette: ThemePalette) => ({ backgroundColor: palette.surface, color: palette.mutedText, borderColor: palette.border }),
};

function usePalette() {
  const themeMode = useThemeStore((state) => state.themeMode);
  return themePalettes[themeMode === "dark" ? "dark" : "light"];
}

export function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  })}`;
}

export function ScreenScroll({ children, bottomNav = false }: PropsWithChildren<{ bottomNav?: boolean }>) {
  const palette = usePalette();

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, bottomNav ? styles.scrollWithNav : null]}>{children}</ScrollView>
      {bottomNav ? <OwnerBottomNav /> : null}
    </View>
  );
}

export function KitaMoBrand({ centered = false }: { centered?: boolean }) {
  const palette = usePalette();

  return (
    <Text style={[styles.brand, { textAlign: centered ? "center" : "left" }]}>
      <Text style={{ color: palette.primary }}>Kita</Text>
      <Text style={{ color: palette.accent }}>Mo</Text>
    </Text>
  );
}

type AppTopBarProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
  centeredBrand?: boolean;
};

export function AppTopBar({ title, subtitle, eyebrow, right, centeredBrand = false }: AppTopBarProps) {
  const palette = usePalette();
  const titleStyle = title.length > 11 ? styles.pageTitleCompact : styles.pageTitle;

  return (
    <View style={styles.topBar}>
      <View style={styles.topText}>
        <KitaMoBrand centered={centeredBrand} />
        {eyebrow ? <Text style={[styles.eyebrow, { color: palette.accent }]}>{eyebrow}</Text> : null}
        <Text style={[titleStyle, { color: palette.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: palette.mutedText }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.topRight}>{right}</View> : null}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>{children}</View>;
}

export function HeroCard({ children }: PropsWithChildren) {
  const palette = usePalette();
  return <View style={[styles.heroCard, { backgroundColor: palette.primary }]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      {action}
    </View>
  );
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const palette = usePalette();
  const toneStyle = toneStyles[tone](palette);
  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.backgroundColor, borderColor: toneStyle.borderColor }]}>
      <Text style={[styles.pillText, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

export function IconBadge({ label, tone = "primary", size = "md" }: { label: string; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const palette = usePalette();
  const toneStyle = toneStyles[tone](palette);
  const dimension = size === "lg" ? 58 : size === "sm" ? 34 : 44;
  return (
    <View
      style={[
        styles.iconBadge,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
          height: dimension,
          width: dimension,
        },
      ]}
    >
      <Text style={[styles.iconBadgeText, { color: toneStyle.color, fontSize: size === "lg" ? 24 : 17 }]}>{label}</Text>
    </View>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  icon?: string;
};

export function MetricCard({ label, value, detail, tone = "primary", icon = "₱" }: MetricCardProps) {
  const palette = usePalette();
  return (
    <Card style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <IconBadge label={icon} tone={tone} />
        <Text style={[styles.metricLabel, { color: palette.text }]}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: tone === "danger" ? palette.danger : tone === "accent" ? palette.accent : palette.primary }]}>
        {value}
      </Text>
      {detail ? <Text style={[styles.metricDetail, { color: palette.mutedText }]}>{detail}</Text> : null}
    </Card>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  href?: Href;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, href, disabled = false }: ButtonProps) {
  const palette = usePalette();
  const content = (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={[styles.primaryButtonText, { color: palette.kioskHeaderText }]}>{label}</Text>
    </Pressable>
  );

  return href ? (
    <Link href={href} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

export function SecondaryButton({ label, onPress, href, disabled = false }: ButtonProps) {
  const palette = usePalette();
  const content = (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.secondaryButton, { backgroundColor: palette.surface, borderColor: palette.border, opacity: disabled ? 0.58 : 1 }]}
    >
      <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );

  return href ? (
    <Link href={href} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

export function FormInput({ label, style, ...inputProps }: TextInputProps & { label: string }) {
  const palette = usePalette();
  const editable = inputProps.editable !== false;

  return (
    <View style={styles.formField}>
      <Text style={[styles.formLabel, { color: palette.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.mutedText}
        {...inputProps}
        style={[
          styles.input,
          {
            backgroundColor: editable ? palette.surface : palette.softPrimary,
            borderColor: palette.border,
            color: palette.text,
            opacity: editable ? 1 : 0.7,
          },
          style,
        ]}
      />
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  amount?: string;
  badge?: string;
  badgeTone?: Tone;
  icon?: string;
  iconTone?: Tone;
  onPress?: () => void;
};

export function ListRow({ title, subtitle, amount, badge, badgeTone = "neutral", icon = "I", iconTone = "primary", onPress }: ListRowProps) {
  const palette = usePalette();
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper onPress={onPress} style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <IconBadge label={icon} tone={iconTone} />
      <View style={styles.listText}>
        <Text style={[styles.listTitle, { color: palette.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.listSubtitle, { color: palette.mutedText }]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.listTrailing}>
        {amount ? <Text style={[styles.listAmount, { color: palette.text }]}>{amount}</Text> : null}
        {badge ? <Pill label={badge} tone={badgeTone} /> : null}
      </View>
    </Wrapper>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.emptyState, { backgroundColor: palette.softPrimary, borderColor: palette.border }]}>
      <IconBadge label="K" tone="primary" size="lg" />
      <View style={styles.emptyText}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
        {description ? <Text style={[styles.emptyDescription, { color: palette.mutedText }]}>{description}</Text> : null}
      </View>
    </View>
  );
}

function OwnerBottomNav() {
  const pathname = usePathname();
  const palette = usePalette();
  const tabs: { href: Href; label: string; icon: string; active: boolean }[] = [
    { href: "/owner", label: "Home", icon: "H", active: pathname === "/owner" },
    { href: "/owner/ask", label: "Ask", icon: "A", active: pathname.includes("/owner/ask") },
    { href: "/owner/records", label: "Records", icon: "R", active: pathname.includes("/owner/records") },
    { href: "/owner/inventory", label: "Inventory", icon: "I", active: pathname.includes("/owner/inventory") },
    { href: "/owner/insights", label: "Insights", icon: "S", active: pathname.includes("/owner/insights") },
  ];

  return (
    <View style={[styles.bottomNav, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {tabs.map((tab) => (
        <Link key={tab.label} href={tab.href} asChild>
          <Pressable style={styles.bottomNavItem}>
            <Text style={[styles.bottomNavIcon, { color: tab.active ? palette.primary : palette.mutedText }]}>{tab.icon}</Text>
            <Text style={[styles.bottomNavText, { color: tab.active ? palette.primary : palette.mutedText }]}>{tab.label}</Text>
            {tab.active ? <View style={[styles.bottomNavIndicator, { backgroundColor: palette.primary }]} /> : null}
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.md,
    padding: 20,
    paddingBottom: spacing.xl,
  },
  scrollWithNav: {
    paddingBottom: 112,
  },
  brand: {
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 44,
  },
  topBar: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  topText: {
    flex: 1,
    gap: 6,
  },
  topRight: {
    alignItems: "flex-end",
    paddingTop: spacing.sm,
  },
  eyebrow: {
    ...typography.label,
  },
  pageTitle: {
    fontSize: 52,
    fontWeight: "900",
    lineHeight: 58,
  },
  pageTitleCompact: {
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 46,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 28,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    gap: spacing.md,
    padding: 18,
  },
  heroCard: {
    borderRadius: 8,
    elevation: 2,
    gap: spacing.sm,
    overflow: "hidden",
    padding: 22,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
  },
  iconBadgeText: {
    fontWeight: "900",
    lineHeight: 24,
  },
  metricCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 154,
  },
  metricHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  metricLabel: {
    ...typography.button,
    flex: 1,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  metricDetail: {
    fontSize: 16,
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    ...typography.button,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.button,
  },
  formField: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 132,
  },
  formLabel: {
    ...typography.button,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  listText: {
    flex: 1,
    gap: spacing.xs,
  },
  listTitle: {
    ...typography.button,
  },
  listSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  listTrailing: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  listAmount: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23,
  },
  emptyState: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  emptyText: {
    flex: 1,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.button,
  },
  emptyDescription: {
    ...typography.body,
  },
  bottomNav: {
    borderTopWidth: 1,
    bottom: 0,
    elevation: 8,
    flexDirection: "row",
    left: 0,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    position: "absolute",
    right: 0,
  },
  bottomNavItem: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs,
    minHeight: 58,
  },
  bottomNavIcon: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
  bottomNavText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  bottomNavIndicator: {
    borderRadius: 2,
    height: 3,
    width: 32,
  },
});
