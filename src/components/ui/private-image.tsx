import React from 'react';
import { Image, type ImageProps } from 'expo-image';
import { usePrivateImage } from '@/hooks/use-private-image';
export function PrivateImage({ uri, ...props }: Omit<ImageProps, 'source'> & { uri: string | null | undefined }) {
  const resolved = usePrivateImage(uri);
  return <Image {...props} source={resolved ? { uri: resolved } : null} cachePolicy="none" />;
}
