import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, Check, ChevronRight, CircleDot, Flashlight, FlashlightOff, Info,
  LoaderCircle, RefreshCw, ShieldAlert, Sparkles, Trash2, Video, VideoOff, X, Zap,
} from 'lucide-react';
import {
  getCameraErrorMessage, listCameraDevices, requestCameraStream, type CameraController, type CameraDeviceInfo,
} from '../domain/camera';
import { playCaptureBeep, triggerHapticFeedback } from '../domain/audio';
import { LiveFormDetector, type DetectionResult } from '../omr/liveDetector';

export interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFiles: (files: File[]) => void;
}

interface CapturedItem {
  id: string;
  file: File;
  previewUrl: string;
  timestamp: string;
}

export function CameraScannerModal({ isOpen, onClose, onAddFiles }: CameraScannerModalProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableDevices, setAvailableDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(true);
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [shutterFlash, setShutterFlash] = useState(false);

  // Canlı vizör tespit durumu
  const [detectorResult, setDetectorResult] = useState<DetectionResult>({
    state: 'searching',
    corners: null,
    stabilityProgress: 0,
    message: 'Optik formu vizörün içine yerleştirin',
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controllerRef = useRef<CameraController | null>(null);
  const detectorRef = useRef<LiveFormDetector | null>(null);
  const isCooldownRef = useRef(false);
  const isCapturingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastAnalysisTimeRef = useRef(0);

  // Kamerayı başlat
  const startCamera = useCallback(async (targetFacingMode: 'environment' | 'user', targetDeviceId?: string) => {
    setIsInitializing(true);
    setError(null);
    setIsPermissionDenied(false);

    // Varsa önceki akışı durdur
    if (controllerRef.current) {
      controllerRef.current.stop();
      controllerRef.current = null;
    }

    try {
      const controller = await requestCameraStream({
        facingMode: targetFacingMode,
        deviceId: targetDeviceId,
        idealWidth: 1920,
        idealHeight: 1080,
      });

      controllerRef.current = controller;
      setHasTorch(controller.hasTorch);
      setIsTorchOn(controller.isTorchOn);

      if (videoRef.current) {
        videoRef.current.srcObject = controller.stream;
        await videoRef.current.play();
      }

      // Kullanılabilir kameraları listele
      const devices = await listCameraDevices();
      setAvailableDevices(devices);

      setIsInitializing(false);
    } catch (camError) {
      const msg = getCameraErrorMessage(camError);
      setError(msg);
      if (camError instanceof DOMException && (camError.name === 'NotAllowedError' || camError.name === 'PermissionDeniedError')) {
        setIsPermissionDenied(true);
      }
      setIsInitializing(false);
    }
  }, []);

  // Modal açıldığında kamerayı aç, kapandığında temizle
  useEffect(() => {
    if (!isOpen) return;

    detectorRef.current = new LiveFormDetector({ stabilityDurationMs: 450 });
    void startCamera(facingMode, selectedDeviceId);

    return () => {
      if (controllerRef.current) {
        controllerRef.current.stop();
        controllerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, startCamera, facingMode, selectedDeviceId]);

  // Manuel veya otomatik fotoğraf çekme fonksiyonu
  const captureFrame = useCallback(async (isAuto = false) => {
    if (!videoRef.current || !controllerRef.current || isCapturingRef.current) return;

    isCapturingRef.current = true;
    try {
      // Deklanşör efekti, ses ve titreşim
      setShutterFlash(true);
      window.setTimeout(() => setShutterFlash(false), 180);
      playCaptureBeep();
      triggerHapticFeedback();

      const file = await controllerRef.current.captureFrame(videoRef.current, 0.95);
      const previewUrl = URL.createObjectURL(file);

      const newItem: CapturedItem = {
        id: crypto.randomUUID(),
        file,
        previewUrl,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setCapturedItems((prev) => [newItem, ...prev]);

      if (isAuto && isContinuousMode) {
        // Seri modda sonraki form için 1.2 saniye bekleme periyodu
        isCooldownRef.current = true;
        detectorRef.current?.reset();
        setDetectorResult({
          state: 'captured',
          corners: null,
          stabilityProgress: 0,
          message: 'Kaydedildi! Sonraki formu yerleştirin…',
        });

        window.setTimeout(() => {
          isCooldownRef.current = false;
          detectorRef.current?.reset();
        }, 1200);
      }
    } catch (captureErr) {
      console.error('Fotoğraf yakalama hatası:', captureErr);
    } finally {
      isCapturingRef.current = false;
    }
  }, [isContinuousMode]);

  // Canlı kare analiz döngüsü
  useEffect(() => {
    if (!isOpen || isInitializing || error) return;

    function loop(now: number) {
      if (!isCooldownRef.current && videoRef.current && detectorRef.current && videoRef.current.readyState >= 2) {
        if (now - lastAnalysisTimeRef.current >= 120) {
          lastAnalysisTimeRef.current = now;
          const result = detectorRef.current.analyzeFrame(videoRef.current, now);
          setDetectorResult(result);

          if (result.state === 'captured') {
            void captureFrame(true);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    }

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, isInitializing, error, captureFrame]);

  // Fener / Flaş aç/kapat
  async function handleToggleTorch() {
    if (!controllerRef.current) return;
    const next = !isTorchOn;
    const success = await controllerRef.current.setTorch(next);
    if (success) setIsTorchOn(next);
  }

  // Ön/Arka kamera değiştir
  function handleFlipCamera() {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    setSelectedDeviceId(undefined);
  }

  // Çekilen bir formu listeden sil
  function handleDeleteCaptured(id: string) {
    setCapturedItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  // Taramayı tamamla ve ana sayfaya aktar
  function handleFinish() {
    if (capturedItems.length > 0) {
      onAddFiles(capturedItems.map((c) => c.file));
      capturedItems.forEach((c) => URL.revokeObjectURL(c.previewUrl));
      setCapturedItems([]);
    }
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="camera-modal-backdrop" role="dialog" aria-modal="true" aria-label="Canlı Kamera ile Optik Form Tarayıcı">
      <div className="camera-modal-container">
        {/* Üst Bilgi ve Kontrol Çubuğu */}
        <header className="camera-modal-header">
          <div className="camera-header-left">
            <span className="camera-live-badge">
              <span className="live-dot" /> CANLI VİZÖR
            </span>
            <span className="camera-count-pill">
              {capturedItems.length} Form Yakalandı
            </span>
          </div>

          <div className="camera-header-actions">
            {availableDevices.length > 1 && (
              <select
                className="camera-device-select"
                value={selectedDeviceId ?? ''}
                onChange={(e) => setSelectedDeviceId(e.target.value || undefined)}
                aria-label="Kamera seçimi"
              >
                {availableDevices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Kamera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}

            {hasTorch && (
              <button
                type="button"
                className={`camera-icon-btn ${isTorchOn ? 'is-active' : ''}`}
                onClick={() => void handleToggleTorch()}
                title={isTorchOn ? 'Flaş/Feneri Kapat' : 'Flaş/Feneri Aç'}
                aria-label="Flaş kontrolü"
              >
                {isTorchOn ? <Flashlight size={19} /> : <FlashlightOff size={19} />}
              </button>
            )}

            <button
              type="button"
              className="camera-icon-btn"
              onClick={handleFlipCamera}
              title="Kamerayı Değiştir (Ön/Arka/Webcam)"
              aria-label="Kamera yönü değiştir"
            >
              <RefreshCw size={18} />
            </button>

            <button
              type="button"
              className={`camera-mode-toggle ${isContinuousMode ? 'is-continuous' : ''}`}
              onClick={() => setIsContinuousMode(!isContinuousMode)}
              title="Seri Tarama: Form sabitlendiğinde otomatik çeker"
            >
              <Zap size={14} />
              <span>{isContinuousMode ? 'Seri Otomatik' : 'Manuel'}</span>
            </button>

            <button
              type="button"
              className="camera-icon-btn camera-close-btn"
              onClick={handleFinish}
              aria-label="Kamerayı kapat"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Video & Vizör Alanı */}
        <div className="camera-viewport-wrap">
          {isInitializing && (
            <div className="camera-loading-state">
              <LoaderCircle className="spin" size={36} />
              <p>Kamera ve görüntü motoru hazırlanıyor…</p>
            </div>
          )}

          {error && (
            <div className="camera-error-state">
              <div className="error-icon-box">
                {isPermissionDenied ? <ShieldAlert size={40} className="text-warning" /> : <VideoOff size={40} className="text-danger" />}
              </div>
              <h3>{isPermissionDenied ? 'Kamera Erişim İzni Gerekli' : 'Kamera Açılamadı'}</h3>
              <p className="error-description">{error}</p>

              {isPermissionDenied ? (
                <div className="permission-guide-card">
                  <h4>💡 Bilgisayar ve Telefonlarda Kamera İzni Nasıl Verilir?</h4>
                  <ol className="permission-steps-list">
                    <li>
                      <strong>1. Adım:</strong> Tarayıcınızın adres çubuğundaki (URL'nin solundaki) <strong>Kilit 🔒 / Site Ayarları</strong> simgesine tıklayın.
                    </li>
                    <li>
                      <strong>2. Adım:</strong> Açılan menüde <strong>Kamera</strong> seçeneğini <strong>"İzin Ver (Allow)"</strong> konumuna getirin.
                    </li>
                    <li>
                      <strong>3. Adım:</strong> Aşağıdaki <strong>"Tekrar Dene"</strong> butonuna tıklayın.
                    </li>
                  </ol>
                  <div className="permission-subtext">
                    <Info size={14} />
                    <span>
                      <strong>Windows kullanıcıları:</strong> Eğer kilit simgesinden izin verdiğiniz halde açılmıyorsa; <em>Windows Ayarları → Gizlilik ve Güvenlik → Kamera</em> bölümünden tarayıcınıza kamera erişim izninin açık olduğunu doğrulayın.
                    </span>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="button button-primary button-large retry-camera-btn"
                onClick={() => void startCamera(facingMode, selectedDeviceId)}
              >
                <RefreshCw size={17} /> Tekrar Dene
              </button>
            </div>
          )}

          <video
            ref={videoRef}
            className="camera-video-stream"
            playsInline
            muted
            autoPlay
          />

          {/* Deklanşör Parlaması */}
          {shutterFlash && <div className="camera-shutter-flash" />}

          {/* Dinamik SVG Vizör Kılavuz Çerçevesi */}
          {!isInitializing && !error && (
            <div className={`camera-viewfinder-overlay state-${detectorResult.state}`}>
              {/* Merkez Rehber Vizör Çerçevesi */}
              <div className="viewfinder-guide-box">
                <span className="corner-bracket top-left" />
                <span className="corner-bracket top-right" />
                <span className="corner-bracket bottom-left" />
                <span className="corner-bracket bottom-right" />

                {/* Kararlılık İlerleme Çizgisi */}
                {detectorResult.stabilityProgress > 0 && detectorResult.stabilityProgress < 1 && (
                  <div className="stability-progress-bar">
                    <span style={{ width: `${detectorResult.stabilityProgress * 100}%` }} />
                  </div>
                )}
              </div>

              {/* Dinamik Durum Bildirim Rozeti */}
              <div className="viewfinder-status-badge">
                {detectorResult.state === 'searching' && <CircleDot size={15} className="spin" />}
                {detectorResult.state === 'aligning' && <Video size={15} />}
                {detectorResult.state === 'stabilizing' && <Sparkles size={15} />}
                {detectorResult.state === 'captured' && <Check size={15} />}
                <span>{detectorResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Alt Çubuk: Çekilen Formlar Şeridi ve Deklanşör */}
        <footer className="camera-modal-footer">
          {/* Çekilen Formların Küçük Önizleme Şeridi */}
          <div className="captured-filmstrip" role="list" aria-label="Yakalanan formlar">
            {capturedItems.length === 0 ? (
              <div className="filmstrip-empty">
                <span>Henüz form yakalanmadı</span>
                <small>Formu vizöre hizalayın veya çekim butonuna basın</small>
              </div>
            ) : (
              capturedItems.map((item, idx) => (
                <div key={item.id} className="filmstrip-thumb" role="listitem">
                  <img src={item.previewUrl} alt={`Yakalanan Form ${idx + 1}`} />
                  <span className="thumb-idx">#{capturedItems.length - idx}</span>
                  <button
                    type="button"
                    className="thumb-delete-btn"
                    onClick={() => handleDeleteCaptured(item.id)}
                    title="Bu çekimi sil"
                    aria-label="Sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="camera-footer-controls">
            {/* Manuel Deklanşör Butonu */}
            <button
              type="button"
              className="camera-shutter-btn"
              onClick={() => void captureFrame(false)}
              disabled={isInitializing || Boolean(error)}
              aria-label="Fotoğraf çek"
              title="Fotoğraf Çek"
            >
              <div className="shutter-inner" />
            </button>

            {/* Taramayı Tamamla Butonu */}
            <button
              type="button"
              className="button button-primary button-large finish-scan-btn"
              onClick={handleFinish}
            >
              <span>Taramayı Tamamla ({capturedItems.length})</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
