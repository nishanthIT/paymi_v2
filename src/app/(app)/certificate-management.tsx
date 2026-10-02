import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import {
  certificateImageUrl,
  certificateKeys,
  createCertificate,
  deleteCertificate,
  fetchCertificates,
  updateCertificate,
  type CertificateInput,
  type CertificateType,
  type ShopCertificate,
} from '@/features/certificates/api';
import { subscribeCertificateEdit } from '@/features/certificates/edit-bridge';
import {
  certificateStatusMeta as statusMeta,
  certificateTypeMeta as typeMeta,
} from '@/features/certificates/meta';
import { DateTimeField } from '@/features/shop-tools/components/date-time-field';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { Fab, RecordCard, StatusPill } from '@/features/shop-tools/components/primitives';
import { OptionPicker } from '@/features/shop-tools/components/option-picker';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { formatDate, formatMoney, formatMoneyTyping, toDateParam } from '@/features/shop-tools/format';
import { secureStorage } from '@/utils/secureStorage';

type TypeTab = 'all' | CertificateType;

/** Certificates & documents vault (owner-only tool). */
export default function CertificateManagementScreen() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [tab, setTab] = useState<TypeTab>('all');
  const [editing, setEditing] = useState<ShopCertificate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>(undefined);

  // Certificate images are behind auth — attach the bearer token to image requests.
  useEffect(() => {
    secureStorage.getToken().then((token) => {
      if (token) setAuthHeaders({ Authorization: `Bearer ${token}` });
    });
  }, []);

  // "Edit" on the details screen returns here and opens the form.
  useEffect(
    () =>
      subscribeCertificateEdit((certificate) => {
        setEditing(certificate);
        setShowForm(true);
      }),
    [],
  );

  const certificates = useQuery({
    queryKey: certificateKeys.list(tab),
    queryFn: () => fetchCertificates(tab === 'all' ? undefined : tab),
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['certificates'] });
  const create = useMutation({ mutationFn: createCertificate, onSettled: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CertificateInput }) =>
      updateCertificate(id, input),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteCertificate, onSettled: invalidate });

  const handleDelete = (certificate: ShopCertificate) => {
    Alert.alert('Delete certificate', `Delete this ${typeMeta[certificate.type].label.toLowerCase()} record?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(certificate.id, {
            onSuccess: () => showToast('Certificate deleted', 'success'),
            onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
          }),
      },
    ]);
  };

  return (
    <ToolScreen title="Certificates" subtitle="Licences, insurance & bills">
      <SegmentedTabs<TypeTab>
        options={[
          { value: 'all', label: 'All' },
          { value: 'INSPECTION', label: 'Inspection' },
          { value: 'INSURANCE', label: 'Insurance' },
          { value: 'ELECTRIC', label: 'Electric' },
          { value: 'HYGIENE', label: 'Hygiene' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {certificates.isLoading ? (
        <ListSkeleton rows={4} height={104} />
      ) : (
        <FlatList
          data={certificates.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={certificates.isRefetching}
              onRefresh={certificates.refetch}
              tintColor={Colors.light.primary}
            />
          }
          renderItem={({ item }) => (
            <RecordCard
              onPress={() =>
                router.push({ pathname: '/(app)/certificate/[id]', params: { id: item.id } })
              }
              onLongPress={() => handleDelete(item)}
            >
              <View style={styles.certRow}>
                <Image
                  source={{ uri: certificateImageUrl(item), headers: authHeaders }}
                  style={styles.certThumb}
                  contentFit="cover"
                />
                <View style={styles.flex1}>
                  <View style={styles.certHead}>
                    <Ionicons name={typeMeta[item.type].icon} size={15} color={Colors.light.primary} />
                    <Text style={styles.certTitle}>{typeMeta[item.type].label}</Text>
                  </View>
                  <Text style={styles.certMeta}>{describeCertificate(item)}</Text>
                  {item.relevantDate && (
                    <Text style={styles.certMeta}>
                      {item.type === 'INSURANCE' || item.type === 'ELECTRIC' ? 'Renews' : 'Expires'}{' '}
                      {formatDate(item.relevantDate)} · remind {item.reminderDays}d before
                    </Text>
                  )}
                </View>
                <StatusPill label={statusMeta[item.status].label} color={statusMeta[item.status].color} />
              </View>
            </RecordCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="ribbon-outline"
              title="No certificates"
              subtitle="Keep photos of your inspection, insurance, electric and hygiene documents in one place."
            />
          }
        />
      )}

      <Fab
        label="Add Certificate"
        onPress={() => {
          setEditing(null);
          setShowForm(true);
        }}
      />

      <CertificateForm
        visible={showForm}
        certificate={editing}
        onClose={() => setShowForm(false)}
        saving={create.isPending || update.isPending}
        onSave={(input) => {
          const mutation = editing
            ? update.mutateAsync({ id: editing.id, input })
            : create.mutateAsync(input);
          mutation
            .then(() => {
              setShowForm(false);
              showToast(editing ? 'Certificate updated' : 'Certificate added', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
        }}
      />
    </ToolScreen>
  );
}

function describeCertificate(certificate: ShopCertificate): string {
  if (certificate.type === 'INSURANCE') {
    return [
      certificate.companyDetails,
      certificate.premiumAmount != null ? formatMoney(certificate.premiumAmount) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (certificate.type === 'ELECTRIC') {
    return `Unit rate ${certificate.unitRate ?? '—'}p · Day ${certificate.readingValueDay ?? '—'} / Night ${certificate.readingValueNight ?? '—'}`;
  }
  return certificate.issuedDate ? `Issued ${formatDate(certificate.issuedDate)}` : 'No issue date';
}

function sanitizeDecimal(text: string): string {
  const normalised = text.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = normalised.split('.');
  return rest.length ? `${whole}.${rest.join('')}` : whole;
}

function CertificateForm({
  visible,
  certificate,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  certificate: ShopCertificate | null;
  onClose: () => void;
  onSave: (input: CertificateInput) => void;
  saving: boolean;
}) {
  const [type, setType] = useState<CertificateType>('INSPECTION');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [reminderDaysText, setReminderDaysText] = useState('7');
  const [issuedDate, setIssuedDate] = useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [renewalDate, setRenewalDate] = useState<Date | null>(null);
  const [premiumAmount, setPremiumAmount] = useState('');
  const [companyDetails, setCompanyDetails] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [readingValueDay, setReadingValueDay] = useState('');
  const [readingValueNight, setReadingValueNight] = useState('');
  const [readingDateDay, setReadingDateDay] = useState<Date | null>(null);
  const [readingDateNight, setReadingDateNight] = useState<Date | null>(null);
  const [contractRenewalDate, setContractRenewalDate] = useState<Date | null>(null);

  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? (certificate?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setType(certificate?.type ?? 'INSPECTION');
      setImageUri(null);
      setReminderDaysText(String(certificate?.reminderDays ?? 7));
      setIssuedDate(certificate?.issuedDate ? new Date(certificate.issuedDate) : null);
      setExpiryDate(certificate?.expiryDate ? new Date(certificate.expiryDate) : null);
      setRenewalDate(certificate?.renewalDate ? new Date(certificate.renewalDate) : null);
      setPremiumAmount(certificate?.premiumAmount != null ? String(certificate.premiumAmount) : '');
      setCompanyDetails(certificate?.companyDetails ?? '');
      setUnitRate(certificate?.unitRate != null ? String(certificate.unitRate) : '');
      setReadingValueDay(certificate?.readingValueDay != null ? String(certificate.readingValueDay) : '');
      setReadingValueNight(certificate?.readingValueNight != null ? String(certificate.readingValueNight) : '');
      setReadingDateDay(certificate?.readingDateDay ? new Date(certificate.readingDateDay) : new Date());
      setReadingDateNight(certificate?.readingDateNight ? new Date(certificate.readingDateNight) : new Date());
      setContractRenewalDate(
        certificate?.contractRenewalDate ? new Date(certificate.contractRenewalDate) : null,
      );
    }
  }

  const handlePickerResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) setImageUri(uri);
    else Alert.alert('No photo', 'That image could not be used. Please try another.');
  };

  const pickImage = async () => {
    try {
      handlePickerResult(
        await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }),
      );
    } catch {
      Alert.alert('Gallery unavailable', 'Could not open your photo library.');
    }
  };

  const takePhoto = async () => {
    let permission = await ImagePicker.getCameraPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await ImagePicker.requestCameraPermissionsAsync();
    }
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access in Settings to photograph your documents, or choose a photo from your gallery.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    try {
      handlePickerResult(
        await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }),
      );
    } catch {
      Alert.alert('Camera unavailable', 'Could not open the camera on this device.');
    }
  };

  const reminderDays = Number(reminderDaysText);
  const baseValid =
    Number.isInteger(reminderDays) &&
    reminderDays >= 1 &&
    reminderDays <= 60 &&
    (certificate != null || imageUri != null);

  const electricMissing =
    type === 'ELECTRIC'
      ? [
          unitRate.trim() === '' && 'unit rate',
          readingValueDay.trim() === '' && 'day reading',
          readingDateDay == null && 'day reading date',
          readingValueNight.trim() === '' && 'night reading',
          readingDateNight == null && 'night reading date',
          contractRenewalDate == null && 'contract renewal date',
        ].filter((field): field is string => Boolean(field))
      : [];

  const typeValid =
    type === 'INSPECTION'
      ? certificate != null || issuedDate != null
      : type === 'INSURANCE'
        ? renewalDate != null && premiumAmount.trim() !== '' && companyDetails.trim() !== ''
        : type === 'ELECTRIC'
          ? electricMissing.length === 0
          : true;

  const valid = baseValid && typeValid;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>{certificate ? 'Edit Certificate' : 'Add Certificate'}</Text>
        {!certificate && (
          <OptionPicker<CertificateType>
            label="Type"
            options={[
              { value: 'INSPECTION', label: 'Inspection' },
              { value: 'INSURANCE', label: 'Insurance' },
              { value: 'ELECTRIC', label: 'Electric' },
              { value: 'HYGIENE', label: 'Hygiene' },
            ]}
            value={type}
            onChange={setType}
          />
        )}

        <View style={styles.photoBlock}>
          <Text style={styles.photoLabel}>
            {certificate ? 'Replace photo (optional)' : 'Photo of the document (required)'}
          </Text>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
          )}
          <View style={styles.pairRow}>
            <Pressable
              onPress={takePhoto}
              accessibilityRole="button"
              style={({ pressed }) => [styles.imagePicker, styles.flex1, pressed && styles.pressed]}
            >
              <Ionicons name="camera-outline" size={20} color={Colors.light.primary} />
              <Text style={styles.imagePickerText}>{imageUri ? 'Retake' : 'Take Photo'}</Text>
            </Pressable>
            <Pressable
              onPress={pickImage}
              accessibilityRole="button"
              style={({ pressed }) => [styles.imagePicker, styles.flex1, pressed && styles.pressed]}
            >
              <Ionicons name="images-outline" size={20} color={Colors.light.primary} />
              <Text style={styles.imagePickerText}>Choose from Gallery</Text>
            </Pressable>
          </View>
        </View>

        {type === 'INSPECTION' && (
          <>
            <DateTimeField label="Issued date" mode="date" value={issuedDate} onChange={setIssuedDate} placeholder="Select date" />
            <DateTimeField label="Expiry date (optional)" mode="date" value={expiryDate} onChange={setExpiryDate} placeholder="None" />
          </>
        )}
        {type === 'INSURANCE' && (
          <>
            <TextField label="Insurance company" value={companyDetails} onChangeText={setCompanyDetails} placeholder="Company & policy details" />
            <TextField label="Premium (£)" value={premiumAmount} onChangeText={(text) => setPremiumAmount(formatMoneyTyping(text))} keyboardType="decimal-pad" placeholder="0.00" />
            <DateTimeField label="Renewal date" mode="date" value={renewalDate} onChange={setRenewalDate} placeholder="Select date" />
          </>
        )}
        {type === 'ELECTRIC' && (
          <>
            <TextField label="Unit rate (p/kWh)" value={unitRate} onChangeText={(text) => setUnitRate(sanitizeDecimal(text))} keyboardType="decimal-pad" placeholder="0.00" />
            <View style={styles.readingGroup}>
              <Text style={styles.readingGroupTitle}>Day meter</Text>
              <TextField label="Day reading (kWh)" value={readingValueDay} onChangeText={(text) => setReadingValueDay(sanitizeDecimal(text))} keyboardType="decimal-pad" placeholder="e.g. 12345" />
              <DateTimeField label="Day reading date" mode="date" value={readingDateDay} onChange={setReadingDateDay} maximumDate={new Date()} placeholder="Select date" />
            </View>
            <View style={styles.readingGroup}>
              <Text style={styles.readingGroupTitle}>Night meter</Text>
              <TextField label="Night reading (kWh)" value={readingValueNight} onChangeText={(text) => setReadingValueNight(sanitizeDecimal(text))} keyboardType="decimal-pad" placeholder="e.g. 6789" />
              <DateTimeField label="Night reading date" mode="date" value={readingDateNight} onChange={setReadingDateNight} maximumDate={new Date()} placeholder="Select date" />
            </View>
            <DateTimeField label="Contract renewal date" mode="date" value={contractRenewalDate} onChange={setContractRenewalDate} placeholder="Select date" />
          </>
        )}
        {type === 'HYGIENE' && (
          <>
            <DateTimeField label="Issued date (optional)" mode="date" value={issuedDate} onChange={setIssuedDate} placeholder="None" />
            <DateTimeField label="Expiry date (optional)" mode="date" value={expiryDate} onChange={setExpiryDate} placeholder="None" />
          </>
        )}

        <TextField
          label="Remind me (days before)"
          value={reminderDaysText}
          onChangeText={setReminderDaysText}
          keyboardType="number-pad"
          placeholder="1–60"
        />

        {electricMissing.length > 0 && (
          <Text style={styles.missingText}>Still needed: {electricMissing.join(', ')}</Text>
        )}
        {!certificate && imageUri == null && (
          <Text style={styles.missingText}>Add a photo of the document to continue.</Text>
        )}

        <PrimaryButton
          title={certificate ? 'Save Changes' : 'Add Certificate'}
          loading={saving}
          disabled={!valid}
          onPress={() => {
            if (!valid) return;
            const isElectric = type === 'ELECTRIC';
            const isInsurance = type === 'INSURANCE';
            const hasIssueDates = type === 'INSPECTION' || type === 'HYGIENE';
            onSave({
              type,
              reminderDays,
              imageUri,
              issuedDate: hasIssueDates && issuedDate ? toDateParam(issuedDate) : undefined,
              expiryDate: hasIssueDates && expiryDate ? toDateParam(expiryDate) : undefined,
              renewalDate: isInsurance && renewalDate ? toDateParam(renewalDate) : undefined,
              premiumAmount: isInsurance ? premiumAmount.trim() || undefined : undefined,
              companyDetails: isInsurance ? companyDetails.trim() || undefined : undefined,
              unitRate: isElectric ? unitRate.trim() || undefined : undefined,
              readingValueDay: isElectric ? readingValueDay.trim() || undefined : undefined,
              readingValueNight: isElectric ? readingValueNight.trim() || undefined : undefined,
              readingDateDay: isElectric && readingDateDay ? toDateParam(readingDateDay) : undefined,
              readingDateNight: isElectric && readingDateNight ? toDateParam(readingDateNight) : undefined,
              contractRenewalDate:
                isElectric && contractRenewalDate ? toDateParam(contractRenewalDate) : undefined,
            });
          }}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  certRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  certThumb: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  certHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  certTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  certMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  sheetContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  sheetTitle: {
    ...Typography.h4,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  pairRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoBlock: {
    gap: Spacing.sm,
  },
  photoLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
  },
  pressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  readingGroup: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.light.backgroundCard,
  },
  readingGroupTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  missingText: {
    ...Typography.caption,
    color: Colors.light.error,
    textAlign: 'center',
  },
  imagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minHeight: 56,
  },
  imagePickerText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.primary,
    flexShrink: 1,
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: BorderRadius.md,
  },
});
