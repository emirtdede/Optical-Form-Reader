export type LiveDetectorState = 'searching' | 'aligning' | 'stabilizing' | 'captured';

export interface Point2D {
  x: number;
  y: number;
}

export interface DetectionResult {
  state: LiveDetectorState;
  corners: [Point2D, Point2D, Point2D, Point2D] | null;
  stabilityProgress: number; // 0.0 ile 1.0 arası
  message: string;
}

export interface LiveDetectorOptions {
  stabilityDurationMs?: number; // Varsayılan: 500ms
  maxJitterThreshold?: number;  // Maksimum izin verilen piksel kıpırdaması (0.05)
  sampleWidth?: number;         // 320
  sampleHeight?: number;        // 240
}

export class LiveFormDetector {
  private lastCorners: [Point2D, Point2D, Point2D, Point2D] | null = null;
  private stableSince: number | null = null;
  private readonly stabilityDurationMs: number;
  private readonly maxJitterThreshold: number;
  private readonly sampleWidth: number;
  private readonly sampleHeight: number;
  private readonly offscreenCanvas: HTMLCanvasElement;
  private readonly offscreenContext: CanvasRenderingContext2D | null;

  constructor(options: LiveDetectorOptions = {}) {
    this.stabilityDurationMs = options.stabilityDurationMs ?? 500;
    this.maxJitterThreshold = options.maxJitterThreshold ?? 0.045;
    this.sampleWidth = options.sampleWidth ?? 320;
    this.sampleHeight = options.sampleHeight ?? 240;

    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.sampleWidth;
    this.offscreenCanvas.height = this.sampleHeight;
    this.offscreenContext = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }

  public reset(): void {
    this.lastCorners = null;
    this.stableSince = null;
  }

  /**
   * Canlı video karesini analiz eder ve formun tespit/stabilite durumunu döner.
   */
  public analyzeFrame(video: HTMLVideoElement, now = performance.now()): DetectionResult {
    if (!video.videoWidth || !video.videoHeight || !this.offscreenContext) {
      return {
        state: 'searching',
        corners: null,
        stabilityProgress: 0,
        message: 'Kamera görüntüsü bekleniyor…',
      };
    }

    // 1. Videoyu düşük çözünürlüklü offscreen canvas'a çiz
    this.offscreenContext.drawImage(video, 0, 0, this.sampleWidth, this.sampleHeight);
    const imageData = this.offscreenContext.getImageData(0, 0, this.sampleWidth, this.sampleHeight);

    // 2. Kontur ve 4 köşe adayını ara
    const detectedCorners = this.detectDocumentCorners(imageData);

    if (!detectedCorners) {
      this.lastCorners = null;
      this.stableSince = null;
      return {
        state: 'searching',
        corners: null,
        stabilityProgress: 0,
        message: 'Optik formu vizörün içine yerleştirin',
      };
    }

    // 3. Önceki kareyle kıpırdama / stabilite karşılaştırması
    if (!this.lastCorners) {
      this.lastCorners = detectedCorners;
      this.stableSince = now;
      return {
        state: 'aligning',
        corners: detectedCorners,
        stabilityProgress: 0.1,
        message: 'Form algılandı, sabit tutun…',
      };
    }

    const jitter = this.calculateJitter(this.lastCorners, detectedCorners);
    this.lastCorners = detectedCorners;

    if (jitter > this.maxJitterThreshold) {
      // Fazla hareket var, stabilite sayacını sıfırla
      this.stableSince = now;
      return {
        state: 'aligning',
        corners: detectedCorners,
        stabilityProgress: 0.2,
        message: 'Kamerayı sabit tutun…',
      };
    }

    // Hareket az, stabilite ilerliyor
    const elapsed = now - (this.stableSince ?? now);
    const progress = Math.min(1.0, Number((elapsed / this.stabilityDurationMs).toFixed(2)));

    if (progress >= 1.0) {
      return {
        state: 'captured',
        corners: detectedCorners,
        stabilityProgress: 1.0,
        message: 'Harika! Form yakalandı.',
      };
    }

    return {
      state: 'stabilizing',
      corners: detectedCorners,
      stabilityProgress: progress,
      message: 'Netleştiriliyor, sabit tutun…',
    };
  }

  /**
   * Görüntü matrisinde en belirgin dörtgen form sınırlarını (A4 / Optik form) tespit eder.
   */
  private detectDocumentCorners(imageData: ImageData): [Point2D, Point2D, Point2D, Point2D] | null {
    const { data, width, height } = imageData;
    const totalPixels = width * height;

    // Gri tonlama ve ortalama parlaklık hesabı
    const gray = new Uint8Array(totalPixels);
    let brightnessSum = 0;

    for (let i = 0; i < totalPixels; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const val = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      gray[i] = val;
      brightnessSum += val;
    }

    const avgBrightness = brightnessSum / totalPixels;
    // Kağıt genellikle arka plandan daha parlaktır (veya masa koyudur)
    const threshold = Math.min(200, Math.max(70, avgBrightness * 1.05));

    // Kenar piksellerini ve beyaz alan sınırlarını tara
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let countAboveThreshold = 0;

    for (let y = Math.round(height * 0.08); y < height * 0.92; y++) {
      for (let x = Math.round(width * 0.08); x < width * 0.92; x++) {
        const val = gray[y * width + x];
        if (val >= threshold) {
          countAboveThreshold++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const detectedWidth = maxX - minX;
    const detectedHeight = maxY - minY;
    const detectedArea = detectedWidth * detectedHeight;
    const canvasArea = width * height;

    // Alan en az %25, en fazla %95 olmalı
    const areaRatio = detectedArea / canvasArea;
    if (areaRatio < 0.22 || areaRatio > 0.96) {
      return null;
    }

    const aspectRatio = detectedHeight / Math.max(1, detectedWidth);
    // Standart A4 dikey en-boy oranı ~1.41 (tolerans 1.15 - 1.85)
    if (aspectRatio < 1.10 || aspectRatio > 1.95) {
      return null;
    }

    // 0-1 normalize edilmiş 4 köşe koordinatı (Sol-Üst, Sağ-Üst, Sağ-Alt, Sol-Alt)
    const paddingX = detectedWidth * 0.02;
    const paddingY = detectedHeight * 0.02;

    const normMinX = Math.max(0, (minX - paddingX) / width);
    const normMaxX = Math.min(1, (maxX + paddingX) / width);
    const normMinY = Math.max(0, (minY - paddingY) / height);
    const normMaxY = Math.min(1, (maxY + paddingY) / height);

    return [
      { x: normMinX, y: normMinY }, // Sol üst
      { x: normMaxX, y: normMinY }, // Sağ üst
      { x: normMaxX, y: normMaxY }, // Sağ alt
      { x: normMinX, y: normMaxY }, // Sol alt
    ];
  }

  private calculateJitter(
    corners1: [Point2D, Point2D, Point2D, Point2D],
    corners2: [Point2D, Point2D, Point2D, Point2D],
  ): number {
    let sumDist = 0;
    for (let i = 0; i < 4; i++) {
      const dx = corners1[i].x - corners2[i].x;
      const dy = corners1[i].y - corners2[i].y;
      sumDist += Math.sqrt(dx * dx + dy * dy);
    }
    return sumDist / 4;
  }
}
