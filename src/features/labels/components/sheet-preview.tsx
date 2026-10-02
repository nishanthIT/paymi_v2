import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LabelComposition } from '../renderer-contract';
import { cellRect, cellsPerSheet, type GridSheet, type SheetPage } from '../render/sheet-layout';
import { LabelTokens as T } from '../tokens';
import { CompositionView } from './composition-view';

/**
 * A4 sheet preview: page on a pale grey surround, preview-only grid guides,
 * real compositions in their physical cells. Empty cells get nothing drawn.
 */
export function SheetPreview({
  sheet,
  pages,
  compositionFor,
  fixture,
}: {
  sheet: GridSheet;
  pages: SheetPage[];
  compositionFor: (itemId: string) => LabelComposition | null;
  /** Sample label shown only when there are no products — never exported. */
  fixture?: { cell: number; composition: LabelComposition };
}) {
  const [pageW, setPageW] = useState(0);
  const scale = pageW > 0 ? pageW / sheet.page.widthMm : 0;
  const pageH = sheet.page.heightMm * scale;
  const cells = cellsPerSheet(sheet);

  return (
    <View style={styles.surround} onLayout={(e) => setPageW(Math.floor(e.nativeEvent.layout.width - 40))}>
      {scale > 0 &&
        pages.map((page, pageIndex) => (
          <View key={pageIndex} style={pageIndex > 0 && styles.nextPage}>
            {pages.length > 1 && (
              <Text style={styles.pageLabel}>
                Sheet {pageIndex + 1} of {pages.length}
              </Text>
            )}
            <View style={[styles.page, { width: pageW, height: pageH }]}>
              {Array.from({ length: cells }, (_, i) => {
                const rect = cellRect(sheet, i + 1);
                const instance = page[i];
                const composition =
                  instance != null
                    ? compositionFor(instance.itemId)
                    : fixture && pageIndex === 0 && fixture.cell === i + 1
                      ? fixture.composition
                      : null;
                return (
                  <View
                    key={i}
                    style={[
                      styles.cell,
                      {
                        left: rect.xMm * scale,
                        top: rect.yMm * scale,
                        width: rect.wMm * scale,
                        height: rect.hMm * scale,
                      },
                    ]}
                  >
                    {composition && <CompositionView composition={composition} scale={scale} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  surround: {
    backgroundColor: T.previewBg,
    borderRadius: T.radiusCard,
    padding: 20,
    alignItems: 'center',
  },
  nextPage: {
    marginTop: 18,
  },
  pageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: T.textSecondary,
    marginBottom: 6,
  },
  page: {
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.labelOutline,
  },
  cell: {
    position: 'absolute',
    // Preview-only cut guides; never part of exported artwork.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.divider,
  },
});
