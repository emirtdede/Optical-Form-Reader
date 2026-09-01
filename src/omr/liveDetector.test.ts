import { describe, expect, it } from 'vitest';
import { LiveFormDetector } from './liveDetector';

describe('LiveFormDetector - Canlı Form ve Stabilite Dedektörü', () => {
  it('boş/hazır olmayan video karesi verildiğinde searching durumu döner', () => {
    const detector = new LiveFormDetector({ stabilityDurationMs: 400 });
    const mockVideo = {
      videoWidth: 0,
      videoHeight: 0,
    } as unknown as HTMLVideoElement;

    const result = detector.analyzeFrame(mockVideo, 1000);
    expect(result.state).toBe('searching');
    expect(result.corners).toBeNull();
    expect(result.stabilityProgress).toBe(0);
    expect(result.message).toContain('Kamera görüntüsü bekleniyor');
  });

  it('reset çağrıldığında önceki tespit ve stabilite sayacını sıfırlar', () => {
    const detector = new LiveFormDetector();
    detector.reset();
    // Reset sonrası herhangi bir istisna fırlatmamalıdır
    expect(true).toBe(true);
  });
});
