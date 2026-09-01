/// <reference lib="webworker" />

import cvModule from '@techstark/opencv-js';
import type { AnswerChoice, FormReadResult, ReadState } from '../types';

const IMAGE_WIDTH = 840;
const IMAGE_HEIGHT = 1200;
const WARP_WIDTH = 720;
const WARP_HEIGHT = 700;
const QUESTIONS_PER_SECTION = 25;
const CHOICES = ['A', 'B', 'C', 'D', 'E'] as const;
// The printed outline of an empty bubble occupies roughly 10–12% of the
// cropped cell. Requiring 18% keeps outlines blank while still accepting
// lightly shaded real-world marks.
const MIN_FILL_RATIO = 0.18;
const MULTI_MARK_RATIO = 0.7;
const STUDENT_GRID_WIDTH = 720;
const STUDENT_GRID_HEIGHT = 260;
const STUDENT_GRID_COLUMNS = 12;
const STUDENT_GRID_ROWS = 11;
const MIN_STUDENT_FILL_RATIO = 0.2;

type Cv = Record<string, any>;
type ContourCandidate = {
  mat: any;
  area: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

class OmrError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

async function getOpenCv(): Promise<Cv> {
  const candidate = cvModule as Cv | Promise<Cv>;
  if (candidate instanceof Promise || typeof (candidate as Promise<Cv>).then === 'function') {
    return candidate;
  }
  if ((candidate as Cv).Mat) return candidate as Cv;
  return new Promise((resolve) => {
    (candidate as Cv).onRuntimeInitialized = () => resolve(candidate as Cv);
  });
}

const cvPromise = getOpenCv();

function safeDelete(...values: any[]) {
  values.forEach((value) => {
    try {
      value?.delete?.();
    } catch {
      // OpenCV nesnesi daha önce serbest bırakılmış olabilir.
    }
  });
}

async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(IMAGE_WIDTH / bitmap.width, IMAGE_HEIGHT / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const offsetX = Math.floor((IMAGE_WIDTH - width) / 2);
    const offsetY = Math.floor((IMAGE_HEIGHT - height) / 2);
    const canvas = new OffscreenCanvas(IMAGE_WIDTH, IMAGE_HEIGHT);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new OmrError('Görüntü işleme alanı başlatılamadı.', 'CANVAS_UNAVAILABLE');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    context.drawImage(bitmap, offsetX, offsetY, width, height);
    return context.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  } finally {
    bitmap.close();
  }
}

function reorderCorners(contour: any): number[] {
  const values = Array.from(contour.data32S as Int32Array);
  const points = Array.from({ length: 4 }, (_, index) => ({
    x: values[index * 2],
    y: values[index * 2 + 1],
  }));
  const topLeft = points.reduce((best, point) => point.x + point.y < best.x + best.y ? point : best);
  const bottomRight = points.reduce((best, point) => point.x + point.y > best.x + best.y ? point : best);
  const topRight = points.reduce((best, point) => point.y - point.x < best.y - best.x ? point : best);
  const bottomLeft = points.reduce((best, point) => point.y - point.x > best.y - best.x ? point : best);
  return [topLeft.x, topLeft.y, topRight.x, topRight.y, bottomLeft.x, bottomLeft.y, bottomRight.x, bottomRight.y];
}

function collectRectangles(cv: Cv, contours: any): ContourCandidate[] {
  const imageArea = IMAGE_WIDTH * IMAGE_HEIGHT;
  const rectangles: ContourCandidate[] = [];

  for (let index = 0; index < contours.size(); index += 1) {
    const contour = contours.get(index);
    const approximation = new cv.Mat();
    try {
      const area = cv.contourArea(contour);
      if (area < imageArea * 0.004 || area > imageArea * 0.3) continue;
      const perimeter = cv.arcLength(contour, true);
      cv.approxPolyDP(contour, approximation, 0.02 * perimeter, true);
      if (approximation.rows !== 4 || !cv.isContourConvex(approximation)) continue;
      const box = cv.boundingRect(approximation);
      rectangles.push({
        mat: contour.clone(),
        area,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      });
    } finally {
      safeDelete(approximation, contour);
    }
  }
  return rectangles;
}

function validateAnswerSections(sections: ContourCandidate[]) {
  if (sections.length !== 4) {
    throw new OmrError(
      'Dört cevap bölgesi algılanamadı. Formu düz, tam kadrajda ve aydınlık biçimde yeniden çekin.',
      'FORM_SECTIONS_NOT_FOUND',
    );
  }
  const areas = sections.map((section) => section.area);
  if (Math.min(...areas) / Math.max(...areas) < 0.55) {
    throw new OmrError('Algılanan cevap bölgelerinin boyutları tutarlı değil.', 'INCONSISTENT_FORM_SECTIONS');
  }
  for (let index = 0; index < sections.length - 1; index += 1) {
    const section = sections[index];
    const next = sections[index + 1];
    if (next.x <= section.x + section.width * 0.65) {
      throw new OmrError('Cevap bölgeleri birbirinden ayrı algılanamadı.', 'OVERLAPPING_FORM_SECTIONS');
    }
    const center = section.y + section.height / 2;
    const nextCenter = next.y + next.height / 2;
    if (Math.abs(center - nextCenter) > Math.max(section.height, next.height) * 0.25) {
      throw new OmrError('Cevap bölgeleri aynı hizada algılanamadı.', 'MISALIGNED_FORM_SECTIONS');
    }
  }
}

function warpContour(cv: Cv, gray: any, contour: any, width: number, height: number): any {
  const approximation = new cv.Mat();
  let source: any;
  let destination: any;
  let matrix: any;
  const warped = new cv.Mat();
  try {
    const perimeter = cv.arcLength(contour, true);
    cv.approxPolyDP(contour, approximation, 0.02 * perimeter, true);
    if (approximation.rows !== 4) {
      throw new OmrError('Form bölgesinin köşeleri belirlenemedi.', 'SECTION_CORNERS_NOT_FOUND');
    }
    source = cv.matFromArray(4, 1, cv.CV_32FC2, reorderCorners(approximation));
    destination = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width - 1, 0, 0, height - 1, width - 1, height - 1]);
    matrix = cv.getPerspectiveTransform(source, destination);
    cv.warpPerspective(gray, warped, matrix, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    return warped;
  } finally {
    safeDelete(approximation, source, destination, matrix);
  }
}

function countNonZeroRegion(mat: any, xStart: number, xEnd: number, yStart: number, yEnd: number): number {
  const data = mat.data as Uint8Array;
  let count = 0;
  for (let y = yStart; y < yEnd; y += 1) {
    const offset = y * mat.cols;
    for (let x = xStart; x < xEnd; x += 1) {
      if (data[offset + x] !== 0) count += 1;
    }
  }
  return count;
}

function readAnswerSections(cv: Cv, gray: any, sections: ContourCandidate[]) {
  const answers: Array<AnswerChoice | null> = [];
  const states: ReadState[] = [];
  const confidences: number[] = [];

  sections.forEach((section) => {
    const warped = warpContour(cv, gray, section.mat, WARP_WIDTH, WARP_HEIGHT);
    const binary = new cv.Mat();
    try {
      cv.threshold(warped, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
      const cellHeight = Math.floor(binary.rows / QUESTIONS_PER_SECTION);
      const cellWidth = Math.floor(binary.cols / CHOICES.length);

      for (let question = 0; question < QUESTIONS_PER_SECTION; question += 1) {
        const rowStart = question * cellHeight;
        const rowEnd = (question + 1) * cellHeight;
        const rowMargin = Math.max(1, Math.round(cellHeight * 0.25));
        const columnMargin = Math.max(1, Math.round(cellWidth * 0.2));
        const fillRatios = CHOICES.map((_, choice) => {
          const xStart = choice * cellWidth + columnMargin;
          const xEnd = (choice + 1) * cellWidth - columnMargin;
          const yStart = rowStart + rowMargin;
          const yEnd = rowEnd - rowMargin;
          const area = Math.max(1, (xEnd - xStart) * (yEnd - yStart));
          return countNonZeroRegion(binary, xStart, xEnd, yStart, yEnd) / area;
        });
        const ranked = fillRatios.map((value, index) => ({ value, index })).sort((left, right) => right.value - left.value);
        const first = ranked[0];
        const second = ranked[1];

        if (first.value < MIN_FILL_RATIO) {
          answers.push(null);
          states.push('blank');
          confidences.push(Number((1 - first.value / MIN_FILL_RATIO).toFixed(4)));
        } else if (second.value >= MIN_FILL_RATIO && second.value / Math.max(first.value, Number.EPSILON) >= MULTI_MARK_RATIO) {
          answers.push(null);
          states.push('ambiguous');
          confidences.push(0);
        } else {
          answers.push(CHOICES[first.index]);
          states.push('marked');
          confidences.push(Number((1 - second.value / Math.max(first.value, Number.EPSILON)).toFixed(4)));
        }
      }
    } finally {
      safeDelete(warped, binary);
    }
  });

  if (answers.length !== 100) throw new OmrError('Beklenen 100 soru okunamadı.', 'QUESTION_COUNT_MISMATCH');
  return { answers, states, confidences };
}

function readStudentNumber(cv: Cv, gray: any, rectangles: ContourCandidate[]) {
  const candidates = rectangles
    .filter((candidate) => candidate.width >= candidate.height * 1.6 && candidate.y < IMAGE_HEIGHT * 0.48)
    .sort((left, right) => right.area - left.area);
  const grid = candidates[0];
  if (!grid) return { value: null, confidence: null };

  const warped = warpContour(cv, gray, grid.mat, STUDENT_GRID_WIDTH, STUDENT_GRID_HEIGHT);
  const binary = new cv.Mat();
  try {
    cv.threshold(warped, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    const cellWidth = binary.cols / STUDENT_GRID_COLUMNS;
    const cellHeight = binary.rows / STUDENT_GRID_ROWS;
    const digits: Array<string | null> = [];
    const confidenceValues: number[] = [];

    for (let column = 1; column < STUDENT_GRID_COLUMNS; column += 1) {
      const ratios = Array.from({ length: 10 }, (_, digit) => {
        const xStart = Math.round(column * cellWidth + cellWidth * 0.2);
        const xEnd = Math.round((column + 1) * cellWidth - cellWidth * 0.2);
        const yStart = Math.round((digit + 1) * cellHeight + cellHeight * 0.18);
        const yEnd = Math.round((digit + 2) * cellHeight - cellHeight * 0.18);
        const area = Math.max(1, (xEnd - xStart) * (yEnd - yStart));
        return countNonZeroRegion(binary, xStart, xEnd, yStart, yEnd) / area;
      });
      const ranked = ratios.map((value, digit) => ({ value, digit })).sort((left, right) => right.value - left.value);
      const first = ranked[0];
      const second = ranked[1];
      if (first.value < MIN_STUDENT_FILL_RATIO) {
        digits.push(null);
        continue;
      }
      if (second.value >= MIN_STUDENT_FILL_RATIO && second.value / Math.max(first.value, Number.EPSILON) >= 0.72) {
        return { value: null, confidence: 0 };
      }
      digits.push(String(first.digit));
      confidenceValues.push(1 - second.value / Math.max(first.value, Number.EPSILON));
    }

    while (digits.at(-1) === null) digits.pop();
    if (digits.length < 5 || digits.some((digit) => digit === null)) return { value: null, confidence: null };
    return {
      value: digits.join(''),
      confidence: Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(4)),
    };
  } finally {
    safeDelete(warped, binary);
  }
}

const BOOKLET_CHOICES = ['A', 'B', 'C', 'D'] as const;

function readBookletType(cv: Cv, gray: any, rectangles: ContourCandidate[]): { value: (typeof BOOKLET_CHOICES)[number] | null; confidence: number | null } {
  const candidates = rectangles
    .filter((c) => c.y < IMAGE_HEIGHT * 0.48 && c.width < IMAGE_HEIGHT * 0.4 && c.area > 1200 && c.area < 50000)
    .sort((a, b) => b.area - a.area);

  for (const candidate of candidates) {
    const warped = warpContour(cv, gray, candidate.mat, 240, 80);
    const binary = new cv.Mat();
    try {
      cv.threshold(warped, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
      const cellWidth = binary.cols / 4;
      const ratios = BOOKLET_CHOICES.map((_, idx) => {
        const xStart = Math.round(idx * cellWidth + cellWidth * 0.15);
        const xEnd = Math.round((idx + 1) * cellWidth - cellWidth * 0.15);
        const yStart = Math.round(binary.rows * 0.15);
        const yEnd = Math.round(binary.rows * 0.85);
        const area = Math.max(1, (xEnd - xStart) * (yEnd - yStart));
        return countNonZeroRegion(binary, xStart, xEnd, yStart, yEnd) / area;
      });
      const ranked = ratios.map((value, idx) => ({ value, type: BOOKLET_CHOICES[idx] })).sort((a, b) => b.value - a.value);
      const first = ranked[0];
      const second = ranked[1];

      if (first.value >= 0.18) {
        if (second.value >= 0.18 && second.value / Math.max(first.value, Number.EPSILON) >= 0.72) {
          return { value: null, confidence: 0 };
        }
        const confidence = Number((1 - second.value / Math.max(first.value, Number.EPSILON)).toFixed(4));
        return { value: first.type, confidence };
      }
    } finally {
      safeDelete(warped, binary);
    }
  }

  return { value: null, confidence: null };
}

async function readForm(file: File): Promise<FormReadResult> {
  if (file.size > 20 * 1024 * 1024) throw new OmrError('Dosya boyutu 20 MB sınırını aşıyor.', 'IMAGE_TOO_LARGE');
  const startedAt = performance.now();
  const [cv, imageData] = await Promise.all([cvPromise, fileToImageData(file)]);
  const source = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const threshold = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let rectangles: ContourCandidate[] = [];
  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.adaptiveThreshold(gray, threshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
    cv.findContours(threshold, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    rectangles = collectRectangles(cv, contours);
    const answerSections = rectangles
      .filter((candidate) => candidate.height >= candidate.width * 1.2)
      .sort((left, right) => right.area - left.area)
      .slice(0, 4)
      .sort((left, right) => left.x - right.x);
    validateAnswerSections(answerSections);
    const answerRead = readAnswerSections(cv, gray, answerSections);
    const studentRead = readStudentNumber(cv, gray, rectangles);
    const bookletRead = readBookletType(cv, gray, rectangles);
    return {
      ...answerRead,
      studentNumber: studentRead.value,
      studentNumberConfidence: studentRead.confidence,
      booklet: bookletRead.value,
      bookletConfidence: bookletRead.confidence,
      diagnostics: {
        averageConfidence: Number((answerRead.confidences.reduce((sum, value) => sum + value, 0) / 100).toFixed(4)),
        contourCount: contours.size(),
        processingMs: Math.round(performance.now() - startedAt),
      },
    };
  } finally {
    rectangles.forEach((rectangle) => safeDelete(rectangle.mat));
    safeDelete(source, gray, threshold, contours, hierarchy);
  }
}

self.onmessage = async (event: MessageEvent<{ id: string; file: File }>) => {
  const { id, file } = event.data;
  try {
    const result = await readForm(file);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: {
        code: error instanceof OmrError ? error.code : 'FORM_READ_FAILED',
        message: error instanceof OmrError
          ? error.message
          : 'Form okunamadı. Görüntünün standart şablona ait, düz ve aydınlık olduğundan emin olun.',
      },
    });
  }
};

void cvPromise
  .then(() => self.postMessage({ type: 'ready' }))
  .catch(() => self.postMessage({
    type: 'init-error',
    error: {
      code: 'ENGINE_INIT_FAILED',
      message: 'Yerel görüntü işleme motoru başlatılamadı. Sayfayı yenileyip tekrar deneyin.',
    },
  }));
