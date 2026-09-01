import { describe, expect, it } from 'vitest';
import { isSupportedImage, sanitizeRecordTitle, studentNumberFromFilename } from './files';

describe('file helpers', () => {
  it('dosya adındaki en uzun 5–12 haneli öğrenci numarasını bulur', () => {
    expect(studentNumberFromFilename('sinif-12345-ogrenci-12345678901.png')).toBe('12345678901');
    expect(studentNumberFromFilename('ogrenci-1234.png')).toBeNull();
  });

  it('başlığı güvenli ve sınırlı hale getirir', () => {
    expect(sanitizeRecordTitle('  <Deneme>   "A"  ')).toBe('Deneme A');
    expect(sanitizeRecordTitle('x'.repeat(100))).toHaveLength(80);
  });

  it('yalnızca desteklenen görüntü biçimlerini kabul eder', () => {
    expect(isSupportedImage(new File(['x'], 'form.png', { type: 'image/png' }))).toBe(true);
    expect(isSupportedImage(new File(['x'], 'form.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});
