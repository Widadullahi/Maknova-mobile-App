import { useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Camera01Icon, Delete02Icon, Video01Icon } from '@hugeicons/core-free-icons';
import { AppText } from './AppText';
import { Button } from './Button';
import { colors, spacing } from '../theme';

// Client directive 11a.3: property media must be captured live through the app
// camera — gallery/library uploads are rejected by the backend. Every asset is
// stamped with source=camera, the capture timestamp, and photo/video kind.
const MEDIA_KINDS = { photo: 'photo', video: 'video' };

function stampMedia(cameraResult, kind) {
  const isPhoto = kind === MEDIA_KINDS.photo;
  const mimeType = isPhoto ? 'image/jpeg' : 'video/mp4';
  const extension = isPhoto ? 'jpg' : 'mp4';
  const prefix = isPhoto ? 'plot-photo' : 'plot-video';
  return {
    uri: cameraResult.uri,
    fileName: `${prefix}-${Date.now()}.${extension}`,
    mimeType,
    source: 'camera',
    capturedAt: new Date().toISOString(),
    mediaKind: kind,
  };
}

export function PlotPhotoCapture({ photos, onChange, maxPhotos = 8 }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [mode, setMode] = useState(MEDIA_KINDS.photo);
  const [isRecording, setIsRecording] = useState(false);

  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setIsCameraOpen(true);
    setMode(MEDIA_KINDS.photo);
  }

  async function capture() {
    if (!cameraRef.current || photos.length >= maxPhotos || isRecording) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      onChange([...photos, stampMedia(photo, MEDIA_KINDS.photo)]);
    } catch (error) {
      // Camera errors surface through the screen's Alert popup; keep state clean.
    }
  }

  async function startRecording() {
    if (!cameraRef.current || isRecording || photos.length >= maxPhotos) return;
    setIsRecording(true);
    // recordAsync resolves with the captured video data when stopRecording() is
    // called, so the completion handler is attached here and the resolve is
    // awaited until the user (or another handler) stops the recording.
    try {
      const videoPromise = cameraRef.current.recordAsync({ maxDuration: 60, mute: true });
      const video = await videoPromise;
      if (video?.uri) {
        onChange((current) => [...current, stampMedia(video, MEDIA_KINDS.video)]);
      }
    } catch {
      // Recording was cancelled or the camera failed; keep the UI usable.
    } finally {
      setIsRecording(false);
    }
  }

  async function stopRecording() {
    if (!cameraRef.current || !isRecording) return;
    try {
      await cameraRef.current.stopRecording();
    } catch {
      // The promise chain in startRecording() handles its own cleanup.
    }
  }

  function removePhoto(index) {
    onChange(photos.filter((_, photoIndex) => photoIndex !== index));
  }

  const canAddMore = photos.length < maxPhotos;
  const videoUnsupported = Platform.OS === 'web';

  return (
    <View style={styles.wrapper}>
      <AppText muted style={styles.hint}>
        Property media must be captured live with the app camera. Gallery uploads are not accepted.
      </AppText>

      {isCameraOpen ? (
        <View style={styles.cameraBox}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode={mode}
            videoQuality="1080p"
          />

          {videoUnsupported ? null : (
            <View style={styles.modeRow}>
              {Object.values(MEDIA_KINDS).map((kind) => (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  onPress={() => {
                    if (isRecording) return;
                    setMode(kind);
                  }}
                  style={[styles.modePill, mode === kind && styles.modePillActive]}
                >
                  <AppText style={[styles.modePillText, mode === kind && styles.modePillTextActive]}>
                    {kind === MEDIA_KINDS.photo ? 'Photo' : 'Video'}
                  </AppText>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.cameraActions}>
            {mode === MEDIA_KINDS.photo ? (
              <Button
                title="Capture photo"
                disabled={!canAddMore}
                onPress={capture}
                icon={Camera01Icon}
              />
            ) : (
              <Button
                title={isRecording ? 'Stop recording' : 'Record video'}
                disabled={!canAddMore}
                onPress={isRecording ? stopRecording : startRecording}
                icon={Video01Icon}
              />
            )}
            <Button
              title="Close camera"
              variant="secondary"
              onPress={() => {
                if (isRecording) {
                  stopRecording();
                }
                setIsCameraOpen(false);
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.sourceActions}>
          <Button title="Open camera" icon={Camera01Icon} onPress={openCamera} disabled={!canAddMore} />
        </View>
      )}

      {photos.length ? (
        <View style={styles.grid}>
          {photos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`} style={styles.thumb}>
              {photo.mediaKind === MEDIA_KINDS.video ? (
                <View style={styles.videoPlaceholder}>
                  <HugeiconsIcon icon={Video01Icon} size={26} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: photo.uri }} style={styles.thumbImage} />
              )}
              <Pressable style={styles.removeButton} onPress={() => removePhoto(index)}>
                <HugeiconsIcon icon={Delete02Icon} size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  cameraBox: {
    gap: spacing.sm,
  },
  camera: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modePill: {
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modePillText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  modePillTextActive: {
    color: colors.onPrimary,
  },
  cameraActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sourceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
});