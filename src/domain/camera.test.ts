import { describe, expect, it } from 'vitest';
import { getCameraErrorMessage, isCameraSupported } from './camera';

describe('camera hardware and error handling', () => {
  it('destek kontrolü tarayıcı ortamında boolean değer döner', () => {
    const supported = isCameraSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('DOMException türlerine göre kullanıcı dostu Türkçe hata mesajları üretir', () => {
    const notAllowed = new DOMException('Permission denied', 'NotAllowedError');
    expect(getCameraErrorMessage(notAllowed)).toContain('Kamera erişim izni reddedildi');

    const notFound = new DOMException('Requested device not found', 'NotFoundError');
    expect(getCameraErrorMessage(notFound)).toContain('kullanılabilir bir kamera (Webcam) bulunamadı');

    const notReadable = new DOMException('Could not start video source', 'NotReadableError');
    expect(getCameraErrorMessage(notReadable)).toContain('başka bir uygulama');

    const security = new DOMException('Insecure context', 'SecurityError');
    expect(getCameraErrorMessage(security)).toContain('güvenli HTTPS bağlantısı');
  });

  it('standart Error ve genel hata nesnelerini düzgün formatlar', () => {
    const genericErr = new Error('Özel donanım hatası');
    expect(getCameraErrorMessage(genericErr)).toBe('Özel donanım hatası');

    const unknownErr = 'Metin hatası';
    expect(getCameraErrorMessage(unknownErr)).toBe('Kamera başlatılırken bilinmeyen bir hata oluştu.');
  });
});
