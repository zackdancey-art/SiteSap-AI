import React from "react";
import { View, Image, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Photo } from "@/lib/types";

type AnnotatedImageProps = {
  photo: Photo;
  width?: number;
};

/**
 * Presentational: renders a photo, and if it's an annotated derivative,
 * overlays its vector strokes scaled to the image box via the SVG viewBox.
 */
export function AnnotatedImage({ photo, width }: AnnotatedImageProps) {
  const source = photo.uri
    ? { uri: photo.uri }
    : photo.base64
      ? { uri: `data:${photo.mimeType || "image/jpeg"};base64,${photo.base64}` }
      : undefined;

  const vector = photo.kind === "annotated" ? photo.annotationVector : undefined;
  const sizeStyle = width ? { width, height: width } : styles.fill;

  return (
    <View style={[styles.wrap, sizeStyle]}>
      {source && <Image source={source} style={styles.image} />}
      {vector && (
        <Svg width="100%" height="100%" viewBox={vector.viewBox} style={StyleSheet.absoluteFillObject}>
          {vector.strokes.map((s, i) => (
            <Path
              key={i}
              d={s.path}
              stroke={s.color}
              strokeWidth={s.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
