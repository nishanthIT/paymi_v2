import { Image } from 'expo-image';
import React, { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { CompositionNode, LabelComposition } from '../renderer-contract';

// Same metric family as the SVG/PDF output so preview widths match print widths.
const ARTWORK_FONT = Platform.select({
  ios: 'Helvetica',
  android: 'sans-serif',
  default: 'Arial, Helvetica, sans-serif',
});

/** Collapse a module string into [start, length] bar runs. */
function barRuns(modules: string): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= modules.length; i++) {
    const bar = modules[i] === '1';
    if (bar && start < 0) start = i;
    if (!bar && start >= 0) {
      runs.push([start, i - start]);
      start = -1;
    }
  }
  return runs;
}

function NodeView({ node, scale }: { node: CompositionNode; scale: number }) {
  switch (node.kind) {
    case 'rect':
      return (
        <View
          style={{
            position: 'absolute',
            left: node.xMm * scale,
            top: node.yMm * scale,
            width: node.wMm * scale,
            height: node.hMm * scale,
            backgroundColor: node.fill,
            borderColor: node.stroke,
            borderWidth: node.stroke ? StyleSheet.hairlineWidth : 0,
            borderRadius: (node.radiusMm ?? 0) * scale,
          }}
        />
      );
    case 'text': {
      const fontSize = node.fontMm * scale;
      const lineHeight = node.lineHeightMm * scale;
      const box = (
        <View
          style={{
            position: 'absolute',
            left: node.xMm * scale,
            top: node.yMm * scale,
            width: node.wMm * scale,
            transform: node.rotateDeg ? [{ rotate: `${node.rotateDeg}deg` }] : undefined,
          }}
        >
          {node.lines.map((line, index) => (
            <Text
              key={index}
              numberOfLines={1}
              ellipsizeMode="clip"
              style={{
                fontFamily: ARTWORK_FONT,
                fontSize,
                lineHeight,
                height: lineHeight,
                fontWeight: node.weight ?? '700',
                fontStyle: node.italic ? 'italic' : 'normal',
                color: node.colour,
                textAlign: node.align ?? 'left',
                textDecorationLine: node.strike ? 'line-through' : node.underline ? 'underline' : 'none',
                includeFontPadding: false,
              }}
            >
              {line}
            </Text>
          ))}
        </View>
      );
      return box;
    }
    case 'price': {
      const fontSize = node.fontMm * scale;
      const lineHeight = node.hMm * scale;
      return (
        <View
          style={{
            position: 'absolute',
            left: node.xMm * scale,
            top: node.yMm * scale,
            width: node.wMm * scale,
            height: lineHeight,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent:
              node.align === 'left' ? 'flex-start' : node.align === 'right' ? 'flex-end' : 'center',
          }}
        >
          <Text
            numberOfLines={1}
            style={[styles.price, { fontSize, lineHeight, color: node.colour }]}
          >
            {node.major}
          </Text>
          {!!node.minor && (
            <Text
              numberOfLines={1}
              style={[
                styles.price,
                {
                  fontSize: fontSize * node.minorScale,
                  lineHeight: fontSize * node.minorScale * 1.1,
                  marginTop: fontSize * 0.12,
                  color: node.colour,
                },
              ]}
            >
              {node.minor}
            </Text>
          )}
        </View>
      );
    }
    case 'barcode': {
      const runs = barRuns(node.modules);
      const count = node.modules.length;
      if (node.rotated) {
        const unit = (node.hMm * scale) / count;
        return (
          <View
            style={{
              position: 'absolute',
              left: node.xMm * scale,
              top: node.yMm * scale,
              width: node.wMm * scale,
              height: node.hMm * scale,
            }}
          >
            {runs.map(([start, length]) => (
              <View
                key={start}
                style={[styles.bar, { top: start * unit, height: length * unit, left: 0, right: 0 }]}
              />
            ))}
          </View>
        );
      }
      const unit = (node.wMm * scale) / count;
      return (
        <View
          style={{
            position: 'absolute',
            left: node.xMm * scale,
            top: node.yMm * scale,
            width: node.wMm * scale,
            height: node.hMm * scale,
          }}
        >
          {runs.map(([start, length]) => (
            <View
              key={start}
              style={[styles.bar, { left: start * unit, width: length * unit, top: 0, bottom: 0 }]}
            />
          ))}
        </View>
      );
    }
    case 'image':
      return (
        <Image
          source={{ uri: node.uri }}
          contentFit="contain"
          style={{
            position: 'absolute',
            left: node.xMm * scale,
            top: node.yMm * scale,
            width: node.wMm * scale,
            height: node.hMm * scale,
          }}
        />
      );
  }
}

/**
 * Draws a renderer composition at `scale` px per mm. `showPreviewOnly`
 * controls simulated stock colour / preview markers (on for app preview).
 */
export const CompositionView = memo(function CompositionView({
  composition,
  scale,
  showPreviewOnly = true,
}: {
  composition: LabelComposition;
  scale: number;
  showPreviewOnly?: boolean;
}) {
  return (
    <View
      style={{
        width: composition.widthMm * scale,
        height: composition.heightMm * scale,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      {composition.nodes.map((node, index) =>
        !showPreviewOnly && 'previewOnly' in node && node.previewOnly ? null : (
          <NodeView key={index} node={node} scale={scale} />
        ),
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  price: {
    fontFamily: ARTWORK_FONT,
    fontWeight: '800',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  bar: {
    position: 'absolute',
    backgroundColor: '#000000',
  },
});
