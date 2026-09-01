import type { ProcessingSettings } from '../types';

export interface DeviceCapability {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

function positiveInteger(value: number, fallback = 1): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

export function detectDeviceCapability(): DeviceCapability {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigatorWithMemory.deviceMemory,
  };
}

export function recommendProcessingSettings(
  itemCount: number,
  capability: DeviceCapability = detectDeviceCapability(),
): ProcessingSettings {
  const total = positiveInteger(itemCount);
  const cores = capability.hardwareConcurrency ?? 4;
  const memory = capability.deviceMemory ?? 4;
  const lowCapability = cores <= 4 || memory <= 4;
  const highCapability = cores >= 8 && memory >= 8;

  let partSize = total <= 25 ? total : total <= 100 ? 25 : total <= 500 ? 50 : 100;
  if (lowCapability) partSize = Math.min(partSize, 25);
  else if (!highCapability) partSize = Math.min(partSize, 50);

  const concurrency = Math.min(total, lowCapability ? 2 : highCapability ? 4 : 3) as 1 | 2 | 3 | 4;
  return {
    concurrency,
    partitionMode: 'size',
    partSize,
    partCount: Math.ceil(total / partSize),
    duplicateMode: 'skip',
    sorting: 'filename',
  };
}

export function normalizeProcessingSettings(settings: ProcessingSettings, itemCount: number): ProcessingSettings {
  const total = positiveInteger(itemCount);
  const concurrency = Math.min(4, positiveInteger(settings.concurrency)) as 1 | 2 | 3 | 4;
  if (settings.partitionMode === 'count') {
    const partCount = Math.min(total, positiveInteger(settings.partCount));
    return { ...settings, concurrency, partCount, partSize: Math.ceil(total / partCount) };
  }
  const partSize = Math.min(total, positiveInteger(settings.partSize));
  return { ...settings, concurrency, partSize, partCount: Math.ceil(total / partSize) };
}

export function partIndexForPosition(position: number, settings: ProcessingSettings): number {
  return Math.floor(position / positiveInteger(settings.partSize));
}

export function settingsRecommendationReason(settings: ProcessingSettings, itemCount: number): string {
  return `${itemCount} form için ${settings.partCount} parça × en fazla ${settings.partSize} form ve ${settings.concurrency} eşzamanlı iş öneriliyor.`;
}
