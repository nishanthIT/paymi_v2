import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';

import type { ChatPhoto } from '../photo-send';

interface Props {
  onClose: () => void;
  onSend: (photo: ChatPhoto) => Promise<void>;
}

/** Mounted only while the conversation is focused, so other cameras can release their previews. */
export function ChatCamera({ onClose, onSend }: Props) {
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const captureGeneration = useRef(0);
  const requested = useRef(false);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [facing, setFacing] = useState<CameraType>('back');
  const [session, setSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [sending, setSending] = useState(false);
  const [photo, setPhoto] = useState<ChatPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; captureGeneration.current += 1; };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const isActive = state === 'active';
      setActive(isActive);
      setReady(false);
      if (!isActive) captureGeneration.current += 1;
      if (isActive) {
        void getPermission().catch(() => {
          if (mounted.current) setError('Could not check camera access. Please try again.');
        });
      }
    });
    return () => subscription.remove();
  }, [getPermission]);

  const askPermission = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      await requestPermission();
    } catch {
      if (mounted.current) setError('Could not request camera access. Please try again.');
    } finally {
      if (mounted.current) setRequesting(false);
    }
  }, [requestPermission]);

  useEffect(() => {
    if (permission?.status !== 'undetermined' || requested.current) return;
    requested.current = true;
    void askPermission();
    // A camera button tap is the permission request. Never repeat after a denial.
  }, [permission?.status, askPermission]);

  useEffect(() => {
    if (!permission?.granted || !active || photo || ready || cameraError) return;
    const timeout = setTimeout(() => {
      setCameraError(true);
      setError('The camera could not start. Try again or choose a photo from the chat gallery.');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [permission?.granted, active, photo, ready, cameraError, session, facing]);

  const close = () => {
    mounted.current = false;
    captureGeneration.current += 1;
    onClose();
  };

  const capture = async () => {
    if (!ready || !active || busy.current || !camera.current) return;
    busy.current = true;
    setCapturing(true);
    setError(null);
    const generation = captureGeneration.current;
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.7, imageType: 'jpg' });
      if (!picture?.uri) throw new Error('No photo was captured. Please try again.');
      if (mounted.current && generation === captureGeneration.current) {
        setReady(false);
        setPhoto({ uri: picture.uri, name: `photo-${Date.now()}.jpg`, mimeType: 'image/jpeg' });
      }
    } catch {
      if (mounted.current && generation === captureGeneration.current) {
        setError('Could not take the photo. Please try again.');
      }
    } finally {
      busy.current = false;
      if (mounted.current) setCapturing(false);
    }
  };

  const send = async () => {
    if (!photo || busy.current || previewError) return;
    busy.current = true;
    setSending(true);
    setError(null);
    try {
      await onSend(photo);
      if (mounted.current) onClose();
    } catch (cause: any) {
      if (mounted.current) setError(cause?.message || 'Photo failed to send. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setSending(false);
    }
  };

  const retryCamera = () => {
    setError(null);
    setCameraError(false);
    setReady(false);
    setSession((value) => value + 1);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close camera" onPress={close} style={[styles.iconButton, styles.closeButton]}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>{photo ? 'Preview photo' : 'Take a photo'}</Text>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.preview}>
          {photo ? (
            <Image accessibilityLabel="Photo preview" source={{ uri: photo.uri }} resizeMode="contain" style={styles.fill} onError={() => { setPreviewError(true); setError('Could not display this photo. Please retake it.'); }} />
          ) : !permission || requesting ? (
            <View style={styles.center}><ActivityIndicator color="#FFFFFF" /><Text style={styles.help}>Checking camera access…</Text></View>
          ) : !permission.granted ? (
            <View style={styles.center}>
              <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
              <Text style={styles.help}>Allow camera access to take and send a photo in this chat.</Text>
              {permission.canAskAgain ? (
                <Pressable accessibilityRole="button" onPress={() => { void askPermission(); }} style={styles.primaryButton}><Text style={styles.buttonText}>Allow camera</Text></Pressable>
              ) : Platform.OS === 'web' ? (
                <Text style={styles.help}>Enable the camera in your browser&apos;s site settings, then reopen the camera.</Text>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings().catch(() => setError('Open your device settings and allow camera access for Paymi.')); }} style={styles.primaryButton}><Text style={styles.buttonText}>Open settings</Text></Pressable>
              )}
            </View>
          ) : cameraError ? (
            <View style={styles.center}>
              <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
              <Pressable accessibilityRole="button" onPress={retryCamera} style={styles.primaryButton}><Text style={styles.buttonText}>Retry camera</Text></Pressable>
            </View>
          ) : active ? (
            <>
              <CameraView key={`${session}-${facing}`} ref={camera} style={styles.fill} facing={facing} mode="picture" onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); setCameraError(true); setError('Could not open the camera. Try again or choose a photo from the chat gallery.'); }} />
              {!ready && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#FFFFFF" /></View>}
            </>
          ) : <View style={styles.center}><Text style={styles.help}>Camera paused</Text></View>}
        </View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {photo ? (
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" disabled={sending} onPress={() => { if (busy.current) return; setPhoto(null); setPreviewError(false); retryCamera(); }} style={[styles.secondaryButton, sending && styles.disabled]}><Text style={styles.buttonText}>Retake</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={sending ? 'Sending photo' : 'Send photo'} disabled={sending || previewError} onPress={() => { void send(); }} style={[styles.primaryButton, (sending || previewError) && styles.disabled]}>
              {sending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={20} color="#FFFFFF" />}
              <Text style={styles.buttonText}>{sending ? 'Sending…' : 'Send photo'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.controls}>
            <View style={styles.iconButton} />
            <Pressable accessibilityRole="button" accessibilityLabel="Take photo" disabled={!ready || !active || capturing || cameraError} onPress={() => { void capture(); }} style={[styles.shutter, (!ready || capturing || cameraError) && styles.disabled]}>
              {capturing ? <ActivityIndicator color="#000000" /> : <View style={styles.shutterInner} />}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Switch camera" disabled={!ready || capturing || cameraError} onPress={() => { if (busy.current) return; setReady(false); setFacing(value => value === 'back' ? 'front' : 'back'); }} style={[styles.iconButton, (!ready || capturing) && styles.disabled]}>
              <Ionicons name="camera-reverse-outline" size={30} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101010' },
  header: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  title: { ...Typography.bodyBold, color: '#FFFFFF' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  closeButton: { backgroundColor: '#383838', borderRadius: 24, borderWidth: 1, borderColor: '#FFFFFF' },
  preview: { flex: 1, minHeight: 0, overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, gap: Spacing.lg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  help: { ...Typography.body, textAlign: 'center', color: '#FFFFFF' },
  error: { ...Typography.body, color: '#FFD5D5', textAlign: 'center', padding: Spacing.md },
  controls: { flexShrink: 0, minHeight: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: Spacing.md, padding: Spacing.md },
  primaryButton: { minHeight: 48, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: 24, backgroundColor: Colors.light.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  secondaryButton: { minHeight: 48, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: 24, backgroundColor: '#333333' },
  buttonText: { ...Typography.bodyBold, color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
});
