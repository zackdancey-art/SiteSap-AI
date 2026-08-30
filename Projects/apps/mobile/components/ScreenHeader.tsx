import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { BackButton } from "@/components/BackButton";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type ScreenHeaderProps = {
  title?: string;
  subtitle?: string;
  variant?: "navy" | "light";
  right?: React.ReactNode;
  backGlyph?: IoniconName;
  backSize?: number;
  backButtonStyle?: StyleProp<ViewStyle>;
  homeFallback?: string;
  paddingHorizontal?: number;
  paddingBottom?: number;
  paddingTopExtra?: number;
  gap?: number;
  titleColor?: string;
  subtitleColor?: string;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  borderColor?: string;
  borderWidth?: number;
  // Default undefined = no truncation, matching the original hand-rolled headers
  // (which wrapped). Screens can opt into single-line truncation explicitly.
  numberOfLines?: number;
};

export function ScreenHeader({
  title,
  subtitle,
  variant = "light",
  right,
  backGlyph = "chevron-back",
  backSize,
  backButtonStyle,
  homeFallback,
  paddingHorizontal = 16,
  paddingBottom = 14,
  paddingTopExtra = 8,
  gap = 12,
  titleColor,
  subtitleColor,
  titleStyle,
  subtitleStyle,
  borderColor = Colors.border,
  borderWidth = StyleSheet.hairlineWidth,
  numberOfLines,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const isNavy = variant === "navy";

  return (
    <View
      style={[
        styles.container,
        {
          gap,
          paddingTop: insets.top + paddingTopExtra,
          paddingHorizontal,
          paddingBottom,
          backgroundColor: isNavy ? Colors.primary : Colors.surface,
        },
        !isNavy && { borderBottomWidth: borderWidth, borderBottomColor: borderColor },
      ]}
    >
      <BackButton
        tone={isNavy ? "onNavy" : "onLight"}
        glyph={backGlyph}
        size={backSize}
        homeFallback={homeFallback}
        style={backButtonStyle}
      />
      <View style={styles.titleWrap}>
        {!!title && (
          <Text
            style={[styles.title, { color: titleColor ?? (isNavy ? Colors.white : Colors.text) }, titleStyle]}
            numberOfLines={numberOfLines}
          >
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text
            style={[
              styles.subtitle,
              { color: subtitleColor ?? (isNavy ? Colors.onPrimaryMuted : Colors.textSecondary) },
              subtitleStyle,
            ]}
            numberOfLines={numberOfLines}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
  },
});
