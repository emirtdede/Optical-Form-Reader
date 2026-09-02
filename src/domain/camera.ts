export interface CameraStreamOptions {
  idealWidth?: number;
  idealHeight?: number;
  facingMode?: 'environment' | 'user';
  deviceId?: string;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
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

export async function listCameraDevices(): Promise<CameraDeviceInfo[]> {
  if (!isCameraSupported() || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Kamera ${index + 1} (${d.deviceId ? d.deviceId.slice(0, 5) : 'Varsayılan'})`,
      }));
  } catch {
    return [];
  }
}

export function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Kamera erişim izni reddedildi. Tarayıcı adres çubuğundaki kilit (Site Bilgileri) simgesine tıklayarak Kamera iznini "İzin Ver" olarak değiştirin ve Tekrar Dene butonuna basın.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Cihazınızda takılı veya kullanılabilir bir kamera (Webcam) bulunamadı. Lütfen kamera bağlantınızı kontrol edin.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Kamera şu anda başka bir uygulama (Zoom, Teams, Discord vb.) tarafından kullanılıyor. Lütfen diğer uygulamaları kapatıp tekrar deneyin.';
      case 'OverconstrainedError':
        return 'İstenen kamera çözünürlüğü cihazınız tarafından desteklenmiyor. Sistem otomatik olarak standart çözünürlüğe geçmeyi deneyecektir.';
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

  // Bilgisayar ve telefonlarda farklı çözünürlük/donanım uyumluluğu için aşamalı kısıtlama listesi
  const candidateConstraints: MediaStreamConstraints[] = [
    // 1. Aşama: İstenen ideal çözünürlük ve yön
    {
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : {
            facingMode: { ideal: facingMode },
            width: { ideal: idealWidth },
            height: { ideal: idealHeight },
          },
    },
    // 2. Aşama: Standart HD (1280x720) genel uyumluluk (Webcam'ler için)
    {
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    // 3. Aşama: Temel fallback (Her türlü kamera donanımını açar)
    {
      audio: false,
      video: true,
    },
  ];

  let stream: MediaStream | null = null;
  let lastError: unknown = null;

  for (const constraints of candidateConstraints) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream && stream.getVideoTracks().length > 0) {
        break;
      }
    } catch (err) {
      lastError = err;
      // Aday başarısız olursa sonraki daha basit kısıtlamayı dene (örn. fallback: { video: true })
    }
  }

  if (!stream) {
    throw lastError || new Error('Kamera video akışı oluşturulamadı.');
  }

  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    throw new Error('Kamera video izi bulunamadı.');
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
    stream?.getTracks().forEach((track) => {
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
