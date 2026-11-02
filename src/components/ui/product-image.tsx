import { Image, type ImageProps } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { getProductImageCandidates } from '@/utils/product-image';

const PAYMI_PLACEHOLDER = require('@/assets/images/icon.png');

type ProductImageProps = Pick<ImageProps, 'style' | 'accessibilityLabel'> & {
  img?: unknown;
  barcode?: string | null;
  /** Enabled only after a real image has loaded; receives the successful fallback URI. */
  onPreview?: (uri: string) => void;
};

/** The bundled logo is visible during loading, offline, and after all sources fail. */
export function ProductImage({ img, barcode, ...props }: ProductImageProps) {
  const candidates = getProductImageCandidates(img, barcode);
  // Remount the request state when a virtualized row is reused for another product.
  return <ProductImageRequest key={JSON.stringify(candidates)} candidates={candidates} {...props} />;
}

function ProductImageRequest({
  candidates,
  style,
  accessibilityLabel = 'Product image',
  onPreview,
}: Omit<ProductImageProps, 'img' | 'barcode'> & { candidates: string[] }) {
  const [{ attempt, loaded }, setRequest] = useState({ attempt: 0, loaded: false });
  const uri = candidates[attempt] ?? null;
  const loadedUri = loaded ? uri : null;
  const image = (
    <Image
      key={uri ?? 'paymi-placeholder'}
      source={uri ? { uri } : PAYMI_PLACEHOLDER}
      placeholder={PAYMI_PLACEHOLDER}
      placeholderContentFit="contain"
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={uri ?? 'paymi-placeholder'}
      transition={150}
      style={onPreview ? StyleSheet.absoluteFill : style}
      accessibilityLabel={uri ? accessibilityLabel : 'PayMi logo — product image unavailable'}
      onLoad={() => {
        if (!uri) return;
        setRequest((current) => current.attempt === attempt ? { attempt, loaded: true } : current);
      }}
      onError={() => {
        if (!uri) return;
        setRequest((current) => current.attempt === attempt ? { attempt: attempt + 1, loaded: false } : current);
      }}
    />
  );
  if (!onPreview) return image;
  return (
    <Pressable
      style={style}
      disabled={!loadedUri}
      accessibilityRole="button"
      accessibilityLabel={loadedUri ? accessibilityLabel : 'Product image unavailable'}
      accessibilityState={{ disabled: !loadedUri }}
      onPress={(event) => {
        event.stopPropagation();
        if (loadedUri) onPreview(loadedUri);
      }}
    >
      {image}
    </Pressable>
  );
}
