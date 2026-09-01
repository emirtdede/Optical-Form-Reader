import { describe, expect, it } from 'vitest';
import { normalizeProcessingSettings, recommendProcessingSettings } from './processing';

describe('processing recommendations', () => {
  it('düşük kapasiteli cihazda küçük part ve iki iş önerir', () => {
    const recommendation = recommendProcessingSettings(125, { hardwareConcurrency: 4, deviceMemory: 4 });
    expect(recommendation).toMatchObject({ concurrency: 2, partSize: 25, partCount: 5, duplicateMode: 'skip' });
  });

  it('güçlü cihazda büyük kuyruk için daha büyük part önerir', () => {
    const recommendation = recommendProcessingSettings(1_000, { hardwareConcurrency: 12, deviceMemory: 16 });
    expect(recommendation).toMatchObject({ concurrency: 4, partSize: 100, partCount: 10 });
  });

  it('kullanıcı part sayısını seçtiğinde part boyutunu tek kaynaktan türetir', () => {
    const recommendation = recommendProcessingSettings(125, { hardwareConcurrency: 8, deviceMemory: 8 });
    const normalized = normalizeProcessingSettings({ ...recommendation, partitionMode: 'count', partCount: 4 }, 125);
    expect(normalized.partSize).toBe(32);
    expect(normalized.partCount).toBe(4);
  });
});
