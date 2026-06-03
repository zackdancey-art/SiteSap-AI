import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  Pressable,
  Text,
  ScrollView,
  Platform,
} from "react-native";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { setPendingAnnotation } from "@/lib/annotationStore";

type PathData = { d: string; color: string; width: number };

const PEN_COLORS = ["#E53935", "#1E88E5", "#43A047", "#FF8F00", "#000000", "#FFFFFF"];
const PEN_WIDTHS = [3, 6, 10, 16];

function buildSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M${points[0].x},${points[0].y} L${points[0].x + 0.1},${points[0].y + 0.1}`;
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const cpx = (prev.x + cur.x) / 2;
    const cpy = (prev.y + cur.y) / 2;
    d += ` Q${prev.x},${prev.y} ${cpx},${cpy}`;
  }
  return d;
}

export default function DrawPhotoScreen() {
  const { uri, photoId } = useLocalSearchParams<{ uri: string; photoId: string }>();

  const [paths, setPaths] = useState<PathData[]>([]);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(PEN_WIDTHS[1]);
  const [imageLayout, setImageLayout] = useState<{ width: number; height: number } | null>(null);
  const [livePathD, setLivePathD] = useState("");

  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const currentPath = useRef("");
  const liveColor = useRef(color);
  const liveWidth = useRef(strokeWidth);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          currentPoints.current = [{ x: e.x, y: e.y }];
          currentPath.current = buildSvgPath(currentPoints.current);
          liveColor.current = color;
          liveWidth.current = strokeWidth;
          setLivePathD(currentPath.current);
        })
        .onUpdate((e) => {
          currentPoints.current.push({ x: e.x, y: e.y });
          currentPath.current = buildSvgPath(currentPoints.current);
          setLivePathD(currentPath.current);
        })
        .onEnd(() => {
          if (currentPath.current) {
            setPaths((prev) => [
              ...prev,
              { d: currentPath.current, color: liveColor.current, width: liveWidth.current },
            ]);
          }
          currentPoints.current = [];
          currentPath.current = "";
          setLivePathD("");
        })
        .runOnJS(true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, strokeWidth]
  );

  const undo = useCallback(() => setPaths((prev) => prev.slice(0, -1)), []);
  const clear = useCallback(() => { setPaths([]); setLivePathD(""); }, []);

  const handleDone = useCallback(() => {
    // Store paths in module-level store; new-entry reads on focus
    setPendingAnnotation(photoId, paths);
    router.back();
  }, [photoId, paths]);

  const handleDiscard = useCallback(() => {
    router.back();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={handleDiscard}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Annotate Photo</Text>
        <Pressable style={[styles.headerBtn, styles.saveBtn]} onPress={handleDone}>
          <Text style={styles.saveBtnText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.canvasContainer}>
        <GestureDetector gesture={panGesture}>
          <View
            style={styles.canvas}
            onLayout={(e) =>
              setImageLayout({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              })
            }
          >
            <Image
              source={{ uri: decodeURIComponent(uri) }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
            {imageLayout && (
              <Svg
                style={StyleSheet.absoluteFill}
                width={imageLayout.width}
                height={imageLayout.height}
              >
                {paths.map((p, i) => (
                  <Path
                    key={i}
                    d={p.d}
                    stroke={p.color}
                    strokeWidth={p.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
                {livePathD !== "" && (
                  <Path
                    d={livePathD}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
              </Svg>
            )}
          </View>
        </GestureDetector>
      </View>

      <View style={styles.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarInner}
        >
          {PEN_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                color === c && styles.colorDotActive,
              ]}
            />
          ))}
          <View style={styles.divider} />
          {PEN_WIDTHS.map((w) => (
            <Pressable
              key={w}
              onPress={() => setStrokeWidth(w)}
              style={[styles.widthBtn, strokeWidth === w && styles.widthBtnActive]}
            >
              <View
                style={[
                  styles.widthDot,
                  {
                    width: w + 4,
                    height: w + 4,
                    borderRadius: (w + 4) / 2,
                    backgroundColor: color,
                  },
                ]}
              />
            </Pressable>
          ))}
          <View style={styles.divider} />
          <Pressable style={styles.toolBtn} onPress={undo} disabled={paths.length === 0}>
            <Ionicons
              name="arrow-undo"
              size={20}
              color={paths.length === 0 ? Colors.textTertiary : Colors.text}
            />
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={clear} disabled={paths.length === 0}>
            <Ionicons
              name="trash-outline"
              size={20}
              color={paths.length === 0 ? Colors.textTertiary : Colors.error}
            />
          </Pressable>
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    width: "auto",
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  canvasContainer: { flex: 1, backgroundColor: "#111" },
  canvas: { flex: 1 },
  toolbar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  toolbarInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: {
    borderColor: Colors.accent,
    transform: [{ scale: 1.2 }],
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  widthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  widthBtnActive: { backgroundColor: `${Colors.accent}20` },
  widthDot: {},
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
