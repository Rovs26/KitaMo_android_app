import { Ionicons } from "@expo/vector-icons";
import { Link, type Href, usePathname, useRouter } from "expo-router";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeStore } from "@/state/themeStore";
import { themePalettes, type ThemePalette } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type Tone = "primary" | "accent" | "success" | "warning" | "danger" | "neutral";
export type IoniconName = ComponentProps<typeof Ionicons>["name"];

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

export function formatQuantity(value: number) {
  return value.toLocaleString("en-PH", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

// Visual height of the bottom navigation before the safe-area inset is added.
const BOTTOM_NAV_BASE_HEIGHT = 66;

export function ScreenScroll({ children, bottomNav = false }: PropsWithChildren<{ bottomNav?: boolean }>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 10);
  const bottomPadding = bottomNav ? BOTTOM_NAV_BASE_HEIGHT + bottomInset + spacing.lg : bottomInset + spacing.lg;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.sm, paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
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
        <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={[titleStyle, { color: palette.text }]}>
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: palette.mutedText }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.topRight}>{right}</View> : null}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.surface }, shadows.card, style]}>{children}</View>;
}

export function HeroCard({ children }: PropsWithChildren) {
  const palette = usePalette();
  return <View style={[styles.heroCard, { backgroundColor: palette.primary }, shadows.hero]}>{children}</View>;
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

// Accepts a modern Ionicon (`icon`) or a legacy letter/emoji (`label`).
// Ionicon wins when both are given, so screens can migrate gradually.
export function IconBadge({
  label,
  icon,
  tone = "primary",
  size = "md",
}: {
  label?: string;
  icon?: IoniconName;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}) {
  const palette = usePalette();
  const toneStyle = toneStyles[tone](palette);
  const dimension = size === "lg" ? 46 : size === "sm" ? 30 : 38;
  const iconSize = size === "lg" ? 24 : size === "sm" ? 16 : 20;
  return (
    <View
      style={[
        styles.iconBadge,
        {
          backgroundColor: toneStyle.backgroundColor,
          height: dimension,
          width: dimension,
        },
      ]}
    >
      {icon ? (
        <Ionicons color={toneStyle.color} name={icon} size={iconSize} />
      ) : (
        <Text style={[styles.iconBadgeText, { color: toneStyle.color, fontSize: size === "lg" ? 20 : 15 }]}>{label ?? ""}</Text>
      )}
    </View>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  icon?: string;
  iconName?: IoniconName;
};

export function MetricCard({ label, value, detail, tone = "primary", icon = "₱", iconName }: MetricCardProps) {
  const palette = usePalette();
  return (
    <Card style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <IconBadge icon={iconName} label={iconName ? undefined : icon} size="sm" tone={tone} />
        <Text numberOfLines={1} style={[styles.metricLabel, { color: palette.mutedText }]}>
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.metricValue, { color: tone === "danger" ? palette.danger : tone === "accent" ? palette.accent : palette.text }]}
      >
        {value}
      </Text>
      {detail ? (
        <Text numberOfLines={1} style={[styles.metricDetail, { color: palette.mutedText }]}>
          {detail}
        </Text>
      ) : null}
    </Card>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  href?: Href;
  disabled?: boolean;
};

// Route via router.push rather than <Link asChild>. On the New Architecture,
// wrapping a Pressable in <Link asChild> drops the Pressable's background/border
// style, making filled buttons render as bare text — so navigation buttons use
// an explicit onPress instead.
export function PrimaryButton({ label, onPress, href, disabled = false }: ButtonProps) {
  const palette = usePalette();
  const router = useRouter();
  const handlePress = href ? () => router.push(href) : onPress;
  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={[styles.primaryButtonText, { color: palette.kioskHeaderText }]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, href, disabled = false }: ButtonProps) {
  const palette = usePalette();
  const router = useRouter();
  const handlePress = href ? () => router.push(href) : onPress;
  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      style={[styles.secondaryButton, { backgroundColor: palette.surface, borderColor: palette.border, opacity: disabled ? 0.58 : 1 }]}
    >
      <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>{label}</Text>
    </Pressable>
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
    <View style={[styles.emptyState, { backgroundColor: palette.softPrimary }]}>
      <IconBadge icon="sparkles-outline" tone="primary" size="lg" />
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
  const insets = useSafeAreaInsets();
  const tabs: { href: Href; label: string; icon: IoniconName; activeIcon: IoniconName; active: boolean }[] = [
    { href: "/owner", label: "Home", icon: "home-outline", activeIcon: "home", active: pathname === "/owner" },
    { href: "/owner/ask", label: "Helper", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses", active: pathname.includes("/owner/ask") },
    { href: "/owner/records", label: "Logbook", icon: "document-text-outline", activeIcon: "document-text", active: pathname.includes("/owner/records") },
    { href: "/owner/inventory", label: "Inventory", icon: "cube-outline", activeIcon: "cube", active: pathname.includes("/owner/inventory") },
    { href: "/owner/insights", label: "Insights", icon: "bar-chart-outline", activeIcon: "bar-chart", active: pathname.includes("/owner/insights") },
  ];

  return (
    <View
      style={[
        styles.bottomNav,
        { backgroundColor: palette.surface, borderColor: palette.border, paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      {tabs.map((tab) => (
        <Link key={tab.label} href={tab.href} asChild>
          <Pressable style={styles.bottomNavItem}>
            <View style={[styles.bottomNavIconWrap, tab.active ? { backgroundColor: palette.softPrimary } : null]}>
              <Ionicons color={tab.active ? palette.primary : palette.mutedText} name={tab.active ? tab.activeIcon : tab.icon} size={19} />
            </View>
            <Text style={[styles.bottomNavText, { color: tab.active ? palette.primary : palette.mutedText, fontWeight: tab.active ? "800" : "600" }]}>
              {tab.label}
            </Text>
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
    gap: 12,
    paddingHorizontal: spacing.md,
  },
  brand: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
  topBar: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingBottom: spacing.xs,
  },
  topText: {
    flex: 1,
    gap: 3,
  },
  topRight: {
    alignItems: "flex-end",
    paddingTop: spacing.xs,
  },
  eyebrow: {
    ...typography.label,
  },
  pageTitle: {
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 30,
  },
  pageTitleCompact: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 27,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  card: {
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  heroCard: {
    borderRadius: radius.xl,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.md,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: radius.md,
    justifyContent: "center",
  },
  iconBadgeText: {
    fontWeight: "900",
    lineHeight: 24,
  },
  metricCard: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: 6,
    padding: spacing.sm + 2,
  },
  metricHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 16,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 25,
  },
  metricDetail: {
    fontSize: 11,
    lineHeight: 15,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    ...typography.button,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
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
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listRow: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm + 2,
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
    borderRadius: radius.md,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    elevation: 8,
    flexDirection: "row",
    left: 0,
    paddingHorizontal: spacing.sm,
    paddingTop: 6,
    position: "absolute",
    right: 0,
  },
  bottomNavItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    minHeight: 50,
  },
  bottomNavIconWrap: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 30,
    justifyContent: "center",
    width: 46,
  },
  bottomNavText: {
    fontSize: 10.5,
    lineHeight: 14,
  },
});
