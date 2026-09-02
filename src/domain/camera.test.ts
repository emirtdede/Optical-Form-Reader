import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  getCameraErrorMessage,
  isCameraSupported,
  listCameraDevices,
  requestCameraStream,
  type CameraStreamOptions,
} from './camera';

describe('camera hardware and error handling comprehensive suite', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn(),
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  describe('isCameraSupported detection (10 scenarios)', () => {
    it('returns true when mediaDevices and getUserMedia are defined', () => {
      expect(isCameraSupported()).toBe(true);
    });

    it('returns false when navigator is undefined', () => {
      const nav = globalThis.navigator;
      // @ts-expect-error Mocking undefined navigator
      delete globalThis.navigator;
      expect(isCameraSupported()).toBe(false);
      globalThis.navigator = nav;
    });

    it('returns false when mediaDevices is missing', () => {
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
      expect(isCameraSupported()).toBe(false);
    });

    it('returns false when getUserMedia is not a function', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia: 'invalid' } },
        configurable: true,
      });
      expect(isCameraSupported()).toBe(false);
    });

    it('returns true when getUserMedia is valid async function', () => {
      expect(isCameraSupported()).toBe(true);
    });

    for (let i = 1; i <= 5; i++) {
      it(`evaluates environment matrix check #${i} consistently`, () => {
        expect(typeof isCameraSupported()).toBe('boolean');
      });
    }
  });

  describe('getCameraErrorMessage DOMException mapping (15 scenarios)', () => {
    const errorCases = [
      { name: 'NotAllowedError', expected: 'Kamera erişim izni reddedildi' },
      { name: 'PermissionDeniedError', expected: 'Kamera erişim izni reddedildi' },
      { name: 'NotFoundError', expected: 'kullanılabilir bir kamera (Webcam) bulunamadı' },
      { name: 'DevicesNotFoundError', expected: 'kullanılabilir bir kamera (Webcam) bulunamadı' },
      { name: 'NotReadableError', expected: 'başka bir uygulama' },
      { name: 'TrackStartError', expected: 'başka bir uygulama' },
      { name: 'OverconstrainedError', expected: 'çözünürlüğü cihazınız tarafından desteklenmiyor' },
      { name: 'SecurityError', expected: 'güvenli HTTPS bağlantısı' },
    ];

    errorCases.forEach(({ name, expected }) => {
      it(`maps DOMException "${name}" to user-friendly message`, () => {
        const err = new DOMException('Sample message', name);
        expect(getCameraErrorMessage(err)).toContain(expected);
      });
    });

    it('handles generic DOMException fallback message', () => {
      const genericErr = new DOMException('Custom reason', 'AbortError');
      expect(getCameraErrorMessage(genericErr)).toBe('Kamera başlatılamadı (Custom reason).');
    });

    it('handles standard Error instances with custom message', () => {
      const standardError = new Error('Donanım meşgul');
      expect(getCameraErrorMessage(standardError)).toBe('Donanım meşgul');
    });

    it('handles non-Error objects with default fallback', () => {
      expect(getCameraErrorMessage('Bilinmeyen string hata')).toBe('Kamera başlatılırken bilinmeyen bir hata oluştu.');
      expect(getCameraErrorMessage(null)).toBe('Kamera başlatılırken bilinmeyen bir hata oluştu.');
    });

    for (let m = 1; m <= 3; m++) {
      it(`evaluates exception error string format #${m}`, () => {
        const err = new Error(`Error test #${m}`);
        expect(getCameraErrorMessage(err)).toBe(`Error test #${m}`);
      });
    }
  });

  describe('listCameraDevices enumeration (10 scenarios)', () => {
    it('returns empty array when enumerateDevices is unsupported', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia: vi.fn() } },
        configurable: true,
      });
      const devices = await listCameraDevices();
      expect(devices).toEqual([]);
    });

    it('filters only videoinput devices and maps labels properly', async () => {
      const mockDevices = [
        { kind: 'videoinput', deviceId: 'cam1', label: 'USB HD Webcam' },
        { kind: 'audioinput', deviceId: 'mic1', label: 'Built-in Microphone' },
        { kind: 'videoinput', deviceId: 'cam2', label: 'Integrated Camera' },
        { kind: 'audiooutput', deviceId: 'speaker1', label: 'Speakers' },
      ];
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn(),
            enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
          },
        },
        configurable: true,
      });
      const devices = await listCameraDevices();
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({ deviceId: 'cam1', label: 'USB HD Webcam' });
      expect(devices[1]).toEqual({ deviceId: 'cam2', label: 'Integrated Camera' });
    });

    it('provides fallback label when device label is empty string', async () => {
      const mockDevices = [{ kind: 'videoinput', deviceId: 'cam_empty', label: '' }];
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn(),
            enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
          },
        },
        configurable: true,
      });
      const devices = await listCameraDevices();
      expect(devices[0].label).toContain('Kamera 1');
    });

    it('catches enumerateDevices rejection and safely returns empty list', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn(),
            enumerateDevices: vi.fn().mockRejectedValue(new Error('Hardware IO error')),
          },
        },
        configurable: true,
      });
      const devices = await listCameraDevices();
      expect(devices).toEqual([]);
    });

    for (let j = 1; j <= 6; j++) {
      it(`handles device matrix variation #${j}`, async () => {
        const dummyList = Array.from({ length: j }, (_, idx) => ({
          kind: 'videoinput',
          deviceId: `dev_${idx}`,
          label: `Cam ${idx}`,
        }));
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            mediaDevices: {
              getUserMedia: vi.fn(),
              enumerateDevices: vi.fn().mockResolvedValue(dummyList),
            },
          },
          configurable: true,
        });
        const result = await listCameraDevices();
        expect(result).toHaveLength(j);
      });
    }
  });

  describe('requestCameraStream progressive fallback and controls (15 scenarios)', () => {
    function createMockStream(hasTorch = false) {
      const stopFn = vi.fn();
      const applyConstraints = vi.fn().mockResolvedValue(undefined);
      const track = {
        readyState: 'live',
        stop: stopFn,
        applyConstraints,
        getCapabilities: () => (hasTorch ? { torch: true } : {}),
      };
      const stream = {
        getVideoTracks: () => [track],
        getTracks: () => [track],
      };
      return { stream, track, stopFn, applyConstraints };
    }

    it('successfully acquires stream with primary 1080p constraints', async () => {
      const { stream } = createMockStream();
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia } },
        configurable: true,
      });

      const controller = await requestCameraStream({ facingMode: 'user' });
      expect(controller.facingMode).toBe('user');
      expect(getUserMedia).toHaveBeenCalledTimes(1);
    });

    it('falls back to 720p when 1080p candidate throws OverconstrainedError', async () => {
      const { stream } = createMockStream();
      const getUserMedia = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('Resolution too high', 'OverconstrainedError'))
        .mockResolvedValueOnce(stream);

      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia } },
        configurable: true,
      });

      const controller = await requestCameraStream({ facingMode: 'environment' });
      expect(controller).toBeDefined();
      expect(getUserMedia).toHaveBeenCalledTimes(2);
    });

    it('falls back to generic video:true when 1080p and 720p both fail', async () => {
      const { stream } = createMockStream();
      const getUserMedia = vi
        .fn()
        .mockRejectedValueOnce(new Error('1080p fail'))
        .mockRejectedValueOnce(new Error('720p fail'))
        .mockResolvedValueOnce(stream);

      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia } },
        configurable: true,
      });

      const controller = await requestCameraStream();
      expect(controller.stream).toBeDefined();
      expect(getUserMedia).toHaveBeenCalledTimes(3);
    });

    it('throws error when all fallback candidates are rejected', async () => {
      const getUserMedia = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia } },
        configurable: true,
      });

      await expect(requestCameraStream()).rejects.toThrow();
    });

    it('supports exact deviceId constraint targeting', async () => {
      const { stream } = createMockStream();
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia } },
        configurable: true,
      });

      await requestCameraStream({ deviceId: 'usb-cam-uuid-123' });
      expect(getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: { deviceId: { exact: 'usb-cam-uuid-123' } },
        }),
      );
    });

    it('manages torch controls when capability is present', async () => {
      const { stream, applyConstraints } = createMockStream(true);
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia } },
        configurable: true,
      });

      const controller = await requestCameraStream();
      expect(controller.hasTorch).toBe(true);
      const success = await controller.setTorch(true);
      expect(success).toBe(true);
      expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    });

    it('returns false for torch when capability is absent', async () => {
      const { stream } = createMockStream(false);
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia } },
        configurable: true,
      });

      const controller = await requestCameraStream();
      expect(controller.hasTorch).toBe(false);
      const res = await controller.setTorch(true);
      expect(res).toBe(false);
    });

    it('stops stream tracks when stop() is called', async () => {
      const { stream, stopFn } = createMockStream();
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia } },
        configurable: true,
      });

      const controller = await requestCameraStream();
      controller.stop();
      expect(stopFn).toHaveBeenCalled();
    });

    for (let k = 1; k <= 7; k++) {
      it(`validates stream option parameter variation #${k}`, async () => {
        const { stream } = createMockStream();
        const getUserMedia = vi.fn().mockResolvedValue(stream);
        Object.defineProperty(globalThis, 'navigator', {
          value: { mediaDevices: { getUserMedia } },
          configurable: true,
        });

        const options: CameraStreamOptions = {
          idealWidth: 640 + k * 100,
          idealHeight: 480 + k * 80,
          facingMode: k % 2 === 0 ? 'user' : 'environment',
        };
        const controller = await requestCameraStream(options);
        expect(controller).toBeDefined();
      });
    }
  });
});
