import React from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export function goBackSafe(homeFallback: string = "/(tabs)") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(homeFallback);
  }
}

type BackButtonProps = {
  tone?: "onLight" | "onNavy";
  glyph?: IoniconName;
  size?: number;
  homeFallback?: string;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ tone = "onLight", glyph = "chevron-back", size = 24, homeFallback = "/(tabs)", style }: BackButtonProps) {
  return (
    <Pressable onPress={() => goBackSafe(homeFallback)} hitSlop={8} style={style}>
      <Ionicons name={glyph} size={size} color={tone === "onNavy" ? Colors.white : Colors.text} />
    </Pressable>
  );
}
