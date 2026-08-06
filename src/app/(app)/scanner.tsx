import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { AddNewProductSheet } from '@/features/lists/components/add-new-product-sheet';
import { BundleOfferSheet } from '@/features/lists/components/bundle-offer-sheet';
import { ProductSheet } from '@/features/lists/components/product-sheet';
import { useAddProduct, useListDetails } from '@/features/lists/hooks/use-list-details';
import { useBarcodeLookup, useSubmitNewProduct } from '@/features/lists/hooks/use-product-search';
import { useSmartAdd } from '@/features/lists/hooks/use-smart-add';
import type { Product } from '@/features/lists/types';
import { emitReportScan } from '@/features/price-reports/scan-bridge';

const FRAME_SIZE = 260;
const beepSource = require('@/assets/sounds/beep.wav');

/**
 * Barcode scanner. A scan locks further detections until the current one is
 * fully handled, so the backend is never hit twice for the same pass.
 */
export default function ScannerScreen() {
  const { listId, intent } = useLocalSearchParams<{ listId?: string; intent?: string }>();
  const isReportIntent = intent === 'report';
  const isCompareIntent = intent === 'compare';
  const router = useRouter();
  const { showToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();

  const player = useAudioPlayer(beepSource);
  const lookupBarcode = useBarcodeLookup();
  const addProduct = useAddProduct();
  const submitNewProduct = useSubmitNewProduct();
  const smartAdd = useSmartAdd(listId ?? undefined);
  const { data: list } = useListDetails(listId ?? '');

  const scanLock = useRef(false);
  const lastBarcode = useRef<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  // Animated scan line
  const lineProgress = useSharedValue(0);
  React.useEffect(() => {
    lineProgress.set(
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineProgress.get() * (FRAME_SIZE - 4) }],
  }));

  const resumeScanning = useCallback(() => {
    setProduct(null);
    setNotFoundBarcode(null);
    setIsLookingUp(false);
    lastBarcode.current = null;
    scanLock.current = false;
  }, []);

  // When the bundle prompt closes (added bundle / single / dismissed), resume scanning.
  const hadBundlePrompt = useRef(false);
  React.useEffect(() => {
    if (smartAdd.bundlePrompt) {
      hadBundlePrompt.current = true;
    } else if (hadBundlePrompt.current) {
      hadBundlePrompt.current = false;
      resumeScanning();
    }
  }, [smartAdd.bundlePrompt, resumeScanning]);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanLock.current || !data) return;
      if (lastBarcode.current === data) return; // duplicate frame of same code
      scanLock.current = true;
      lastBarcode.current = data;

      try {
        player.seekTo(0);
        player.play();
      } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      setIsLookingUp(true);
      try {
        const found = await lookupBarcode(data);
        setIsLookingUp(false);
        if (found) {
          if (isReportIntent) {
            // Hand the product back to the wrong-price report screen.
            emitReportScan({
              id: found.id,
              title: found.title,
              barcode: found.barcode,
              img: found.img,
            });
            router.back();
            return;
          }
          if (isCompareIntent) {
            // Jump straight into the comparison screen for the scanned product.
            router.replace({
              pathname: '/(app)/compare/[productId]',
              params: { productId: found.id },
            });
            return;
          }
          setProduct(found);
        } else {
          setNotFoundBarcode(data);
        }
      } catch (error: any) {
        setIsLookingUp(false);
        showToast(error?.message ?? 'Barcode lookup failed', 'error');
        resumeScanning();
      }
    },
    [isCompareIntent, isReportIntent, lookupBarcode, player, resumeScanning, router, showToast],
  );

  const handleAdd = async (selected: Product, quantity: number) => {
    if (!listId) return;
    setProduct(null);
    // Bundle-aware add: shows the bundle sheet when the product is part of an
    // active offer, otherwise adds directly. The short delay lets the product
    // sheet's modal finish dismissing before the bundle sheet is presented —
    // iOS won't present a modal while another is still closing.
    const outcome = await smartAdd.requestAdd(selected, quantity, { presentDelayMs: 350 });
    if (outcome === 'added') resumeScanning();
  };

  if (!permission) {
    return <View style={styles.permissionScreen} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <View style={styles.permissionContent}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={40} color={Colors.light.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Allow camera access to scan product barcodes straight into your list.
          </Text>
          <PrimaryButton title="Allow Camera" onPress={requestPermission} />
          <PrimaryButton title="Go Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={
          product || notFoundBarcode || isLookingUp || smartAdd.bundlePrompt
            ? undefined
            : handleBarcodeScanned
        }
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topTitle}>Scan Barcode</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.frameArea}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {!product && !notFoundBarcode && !isLookingUp && (
              <Animated.View style={[styles.scanLine, lineStyle]} />
            )}
            {isLookingUp && (
              <View style={styles.lookupOverlay}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.lookupText}>Looking up product…</Text>
              </View>
            )}
          </View>
          <Text style={styles.hint}>Align the barcode inside the frame</Text>
        </View>
      </SafeAreaView>

      <ProductSheet
        product={product}
        visible={!!product}
        onClose={resumeScanning}
        inList={!!product && (list?.products ?? []).some((p) => p.productId === product.id)}
        onAdd={handleAdd}
      />

      <BundleOfferSheet
        prompt={smartAdd.bundlePrompt}
        claiming={smartAdd.isClaiming}
        onAddBundle={smartAdd.addBundleFromPrompt}
        onAddSingle={smartAdd.addSingleFromPrompt}
        onClose={smartAdd.dismissBundle}
      />

      <AddNewProductSheet
        visible={!!notFoundBarcode}
        barcode={notFoundBarcode ?? ''}
        onClose={resumeScanning}
        submitting={submitNewProduct.isPending}
        onSubmit={({ title, retailSize }) => {
          if (!notFoundBarcode) return;
          submitNewProduct.mutate(
            { barcode: notFoundBarcode, title, retailSize },
            {
              onSuccess: (newProduct) => {
                if (listId) {
                  // Already has a usable (Unknown Shop) inventory row — add it straight to the list.
                  addProduct.mutate(
                    { listId, product: newProduct, quantity: 1 },
                    {
                      onError: () =>
                        showToast('Submitted for review, but could not add it to the list', 'error'),
                    },
                  );
                  showToast('Submitted for review and added to your list', 'success');
                } else {
                  showToast('Submitted for review — an admin will approve it soon', 'success');
                }
                resumeScanning();
              },
              onError: (error) => showToast(error.message, 'error'),
            },
          );
        }}
      />
    </View>
  );
}

const GOLD = Colors.light.primary;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
  frameArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: GOLD,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: BorderRadius.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: BorderRadius.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: BorderRadius.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: BorderRadius.md,
  },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2.5,
    borderRadius: BorderRadius.full,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  lookupOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.lg,
  },
  lookupText: {
    ...Typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  hint: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  permissionIcon: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  permissionTitle: {
    ...Typography.h3,
    color: Colors.light.text,
    textAlign: 'center',
  },
  permissionBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
});
