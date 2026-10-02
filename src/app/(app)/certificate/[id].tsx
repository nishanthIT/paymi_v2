import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  certificateImageUrl,
  certificateKeys,
  fetchCertificate,
  type ShopCertificate,
} from '@/features/certificates/api';
import { saveCertificateToFolder, shareCertificate } from '@/features/certificates/download';
import { emitCertificateEdit } from '@/features/certificates/edit-bridge';
import { certificateStatusMeta, certificateTypeMeta } from '@/features/certificates/meta';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { StatusPill } from '@/features/shop-tools/components/primitives';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { formatDate, formatDateTime, formatMoney } from '@/features/shop-tools/format';
import { secureStorage } from '@/utils/secureStorage';

type Row = { label: string; value: string };

function detailRows(certificate: ShopCertificate): Row[] {
  const date = (value?: string | null) => (value ? formatDate(value) : '—');
  const text = (value?: string | number | null) =>
    value === null || value === undefined || value === '' ? '—' : String(value);

  switch (certificate.type) {
    case 'INSURANCE':
      return [
        { label: 'Insurance company', value: text(certificate.companyDetails) },
        {
          label: 'Premium',
          value: certificate.premiumAmount != null ? formatMoney(certificate.premiumAmount) : '—',
        },
        { label: 'Renewal date', value: date(certificate.renewalDate) },
      ];
    case 'ELECTRIC':
      return [
        {
          label: 'Unit rate',
          value: certificate.unitRate != null ? `${certificate.unitRate}p / kWh` : '—',
        },
        { label: 'Day reading', value: text(certificate.readingValueDay) },
        { label: 'Day reading date', value: date(certificate.readingDateDay) },
        { label: 'Night reading', value: text(certificate.readingValueNight) },
        { label: 'Night reading date', value: date(certificate.readingDateNight) },
        { label: 'Contract renewal', value: date(certificate.contractRenewalDate) },
      ];
    default:
      return [
        { label: 'Issued', value: date(certificate.issuedDate) },
        { label: 'Expires', value: date(certificate.expiryDate) },
      ];
  }
}

/** Read-only view of a saved certificate with full-screen image preview and download. */
export default function CertificateDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>(undefined);
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [imageAttempt, setImageAttempt] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState<'save' | 'share' | null>(null);

  useEffect(() => {
    secureStorage.getToken().then((token) => {
      if (token) setAuthHeaders({ Authorization: `Bearer ${token}` });
    });
  }, []);

  const cachedFromList = () =>
    queryClient
      .getQueriesData<ShopCertificate[]>({ queryKey: ['certificates', 'list'] })
      .flatMap(([, list]) => list ?? [])
      .find((item) => item.id === id);

  const certificate = useQuery({
    queryKey: certificateKeys.detail(id),
    queryFn: () => fetchCertificate(id),
    enabled: !!id,
    // Show the list's copy instantly while the fresh record loads.
    placeholderData: cachedFromList,
  });

  const data = certificate.data ?? (certificate.isError ? cachedFromList() : undefined);
  const imageMissing = data?.imageAvailable === false || imageState === 'error';

  const runDownload = async (kind: 'save' | 'share') => {
    if (!data || downloading) return;
    setDownloading(kind);
    try {
      if (kind === 'save') {
        const saved = await saveCertificateToFolder(data);
        if (saved) showToast('Certificate saved', 'success');
      } else {
        await shareCertificate(data);
      }
    } catch (error: any) {
      showToast(error?.message ?? 'Download failed', 'error');
    } finally {
      setDownloading(null);
    }
  };

  if (!data) {
    return (
      <ToolScreen title="Certificate">
        {certificate.isError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Certificate unavailable"
            subtitle={(certificate.error as Error)?.message ?? 'It may have been deleted.'}
          />
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.light.primary} />
          </View>
        )}
      </ToolScreen>
    );
  }

  const typeInfo = certificateTypeMeta[data.type];
  const status = certificateStatusMeta[data.status];
  const imageSource = { uri: certificateImageUrl(data), headers: authHeaders };

  return (
    <ToolScreen
      title={`${typeInfo.label} certificate`}
      subtitle={status.label}
      rightIcon="create-outline"
      onRightPress={() => {
        emitCertificateEdit(data);
        router.back();
      }}
      scroll
      refreshing={certificate.isRefetching}
      onRefresh={certificate.refetch}
    >
      <View style={styles.imageCard}>
        {imageMissing ? (
          <View style={styles.imageFallback}>
            <Ionicons name="image-outline" size={32} color={Colors.light.textLight} />
            <Text style={styles.fallbackText}>
              {data.imageAvailable === false
                ? 'The document file is missing on the server.'
                : 'Could not load the document image.'}
            </Text>
            {data.imageAvailable !== false && (
              <Pressable
                onPress={() => {
                  setImageState('loading');
                  setImageAttempt((n) => n + 1);
                  certificate.refetch();
                }}
                hitSlop={8}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            )}
          </View>
        ) : (
          authHeaders && (
            <Pressable
              onPress={() => imageState === 'ready' && setPreviewOpen(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Open certificate image full screen"
            >
              <Image
                key={imageAttempt}
                source={imageSource}
                style={styles.image}
                contentFit="cover"
                transition={150}
                onLoad={() => setImageState('ready')}
                onError={() => setImageState('error')}
              />
              {imageState === 'loading' && (
                <View style={styles.imageOverlay}>
                  <ActivityIndicator color={Colors.light.primary} />
                </View>
              )}
              {imageState === 'ready' && (
                <View style={styles.expandBadge}>
                  <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.expandText}>Tap to view</Text>
                </View>
              )}
            </Pressable>
          )
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name={typeInfo.icon} size={18} color={Colors.light.primary} />
          <Text style={styles.cardTitle}>{typeInfo.label}</Text>
          <View style={styles.flex1} />
          <StatusPill label={status.label} color={status.color} />
        </View>
        {detailRows(data).map((row) => (
          <DetailRow key={row.label} {...row} />
        ))}
        <View style={styles.divider} />
        <DetailRow label="Reminder" value={`${data.reminderDays} days before`} />
        <DetailRow label="Added" value={formatDateTime(data.createdAt)} />
        {data.updatedAt !== data.createdAt && (
          <DetailRow label="Last updated" value={formatDateTime(data.updatedAt)} />
        )}
      </View>

      <View style={styles.actions}>
        {Platform.OS === 'android' ? (
          <>
            <PrimaryButton
              title="Download to device"
              onPress={() => runDownload('save')}
              loading={downloading === 'save'}
              disabled={imageMissing || downloading !== null}
            />
            <PrimaryButton
              title="Share"
              variant="ghost"
              onPress={() => runDownload('share')}
              loading={downloading === 'share'}
              disabled={imageMissing || downloading !== null}
            />
          </>
        ) : (
          <PrimaryButton
            title="Download / Share"
            onPress={() => runDownload('share')}
            loading={downloading === 'share'}
            disabled={imageMissing || downloading !== null}
          />
        )}
      </View>

      <ImagePreview
        visible={previewOpen}
        source={imageSource}
        onClose={() => setPreviewOpen(false)}
        onDownload={() => runDownload(Platform.OS === 'android' ? 'save' : 'share')}
        downloading={downloading !== null}
      />
    </ToolScreen>
  );
}

function DetailRow({ label, value }: Row) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ImagePreview({
  visible,
  source,
  onClose,
  onDownload,
  downloading,
}: {
  visible: boolean;
  source: { uri: string; headers?: Record<string, string> };
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.previewRoot}>
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.previewContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image source={source} style={{ width, height }} contentFit="contain" />
        </ScrollView>
        <View style={[styles.previewBar, { top: insets.top + Spacing.sm }]}>
          <Pressable
            onPress={onClose}
            style={styles.previewButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={onDownload}
            disabled={downloading}
            style={styles.previewButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Download certificate"
          >
            {downloading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={22} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCard: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSecondary,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  image: {
    width: '100%',
    height: 260,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBadge: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  expandText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  imageFallback: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  fallbackText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  retryText: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  card: {
    marginTop: Spacing.md,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowLabel: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  rowValue: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.divider,
    marginVertical: Spacing.xs,
  },
  actions: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  previewRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBar: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
