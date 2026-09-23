'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCcw, Trash2, Video } from 'lucide-react';
import { ActionButton } from './ActionButton';
import styles from './dashboard.module.css';

/**
 * Anti-fraud requirement: property photos must come from a live camera capture,
 * never a gallery/file picker. This component never renders a file <input> — the
 * only way to add a photo is through this component's live getUserMedia() feed,
 * so there is no code path here that accepts an existing image file.
 *
 * Web caveat: unlike native camera capture, a technically determined user could
 * still intercept the getUserMedia stream at the OS level (e.g. a virtual camera
 * driver). This defends against the common case (picking a saved/stock photo from
 * the file system) but is not an absolute guarantee on desktop browsers.
 */
export function CameraCapture({ photos, onChange, maxPhotos = 8 }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => stopStream, []);

  async function startCamera() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsStreaming(true);
    } catch (err) {
      setError('Camera access was denied or is unavailable. Enable camera permissions to capture property photos.');
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsStreaming(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `plot-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onChange([...photos, { file, previewUrl: URL.createObjectURL(blob), capturedAt: new Date().toISOString() }]);
      },
      'image/jpeg',
      0.9,
    );
  }

  function removePhoto(index) {
    const next = [...photos];
    const [removed] = next.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
  }

  return (
    <div className={styles.cameraCapture}>
      <p className={styles.cameraHint}>
        Live camera capture only — property photos cannot be uploaded from your gallery or files, to prevent stock/stale
        images being listed as the current state of a plot.
      </p>

      {error ? <div className={styles.loginError}>{error}</div> : null}

      {isStreaming ? (
        <>
          <div className={styles.cameraViewport}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} muted playsInline />
          </div>
          <div className={styles.rowActions}>
            <ActionButton icon={Camera} tone="positive" onClick={capturePhoto} disabled={photos.length >= maxPhotos}>
              Capture photo
            </ActionButton>
            <ActionButton icon={RefreshCcw} onClick={stopStream}>Stop camera</ActionButton>
          </div>
        </>
      ) : (
        <ActionButton icon={Video} tone="positive" onClick={startCamera}>
          Open camera
        </ActionButton>
      )}

      {photos.length ? (
        <div className={styles.cameraThumbGrid}>
          {photos.map((photo, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className={styles.cameraThumb} key={photo.previewUrl || index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`Captured plot photo ${index + 1}`} src={photo.previewUrl} />
              <button className={styles.cameraThumbRemove} onClick={() => removePhoto(index)} type="button">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
