export interface CameraStreamOptions {
  idealWidth?: number;
  idealHeight?: number;
  facingMode?: 'environment' | 'user';
  deviceId?: string;
}

export interface CameraController {
  stream: MediaStream;
  videoTrack: MediaStreamTrack;
  hasTorch: boolean;
  isTorchOn: boolean;
  facingMode: 'environment' | 'user';
  setTorch: (enabled: boolean) => Promise<boolean>;
  captureFrame: (video: HTMLVideoElement, quality?: number) => Promise<File>;
  stop: () => void;
}

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
  );
}

export function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Kamera erişim izni reddedildi. Tarayıcı adres çubuğundaki kilit simgesine tıklayarak kamera iznini onaylayın.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Cihazınızda kullanılabilir bir kamera bulunamadı.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Kamera başka bir uygulama tarafından kullanılıyor olabilir. Lütfen diğer kamera uygulamalarını kapatıp tekrar deneyin.';
      case 'OverconstrainedError':
        return 'İstenen kamera çözünürlüğü veya özellikleri cihazınız tarafından desteklenmiyor.';
      case 'SecurityError':
        return 'Kamera yalnızca güvenli HTTPS bağlantısı veya localhost üzerinde çalışır.';
      default:
        return `Kamera başlatılamadı (${error.message || error.name}).`;
    }
  }
  return error instanceof Error ? error.message : 'Kamera başlatılırken bilinmeyen bir hata oluştu.';
}

export async function requestCameraStream(options: CameraStreamOptions = {}): Promise<CameraController> {
  if (!isCameraSupported()) {
    throw new Error('Tarayıcınız veya cihazınız kamera erişimini (MediaDevices API) desteklemiyor.');
  }

  const {
    idealWidth = 1920,
    idealHeight = 1080,
    facingMode = 'environment',
    deviceId,
  } = options;

  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      facingMode: deviceId ? undefined : { ideal: facingMode },
      width: { ideal: idealWidth, min: 640 },
      height: { ideal: idealHeight, min: 480 },
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const videoTrack = stream.getVideoTracks()[0];

  if (!videoTrack) {
    throw new Error('Kamera video akışı oluşturulamadı.');
  }

  let isTorchOn = false;
  const capabilities = typeof videoTrack.getCapabilities === 'function' ? (videoTrack.getCapabilities() as { torch?: boolean }) : {};
  const hasTorch = Boolean(capabilities.torch);

  async function setTorch(enabled: boolean): Promise<boolean> {
    if (!hasTorch || videoTrack.readyState !== 'live') return false;
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: enabled } as MediaTrackConstraintSet],
      });
      isTorchOn = enabled;
      return true;
    } catch {
      return false;
    }
  }

  async function captureFrame(video: HTMLVideoElement, quality = 0.95): Promise<File> {
    const videoWidth = video.videoWidth || 1920;
    const videoHeight = video.videoHeight || 1080;

    const canvas = document.createElement('canvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Fotoğraf karesi oluşturmak için canvas bağlamı alınamadı.');
    }

    context.drawImage(video, 0, 0, videoWidth, videoHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Kamera karesi JPEG formatına dönüştürülemedi.'))),
        'image/jpeg',
        quality,
      );
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `kamera-tarama-${timestamp}.jpg`;
    return new File([blob], filename, { type: 'image/jpeg' });
  }

  function stop() {
    if (isTorchOn) {
      void setTorch(false);
    }
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Safe ignore
      }
    });
  }

  return {
    stream,
    videoTrack,
    hasTorch,
    isTorchOn,
    facingMode,
    setTorch,
    captureFrame,
    stop,
  };
}
