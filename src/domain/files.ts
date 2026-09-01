const STUDENT_NUMBER_PATTERN = /(?:^|\D)(\d{5,12})(?=\D|$)/g;

export function studentNumberFromFilename(filename: string): string | null {
  const baseName = filename.replace(/\.[^.]+$/, '');
  const candidates = [...baseName.matchAll(STUDENT_NUMBER_PATTERN)].map((match) => match[1]);
  if (!candidates.length) return null;
  return candidates.sort((left, right) => right.length - left.length)[0];
}

export function sanitizeRecordTitle(value: string): string {
  return value.replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function isSupportedImage(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function makeGeneratedStudentNumber(index: number): string {
  return `INCELE-${String(index + 1).padStart(3, '0')}`;
}
