import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type JSZip from 'jszip';
import { MAX_ARCHIVE_SIZE_BYTES, MAX_FILE_SIZE_BYTES, MAX_PDF_SIZE_BYTES } from '../constants';
import type { QueueItem } from '../types';
import { isSupportedImage } from './files';

export interface ExpandedSources {
  items: QueueItem[];
  skipped: number;
  warnings: string[];
}

const naturalCollator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function isZip(file: File): boolean {
  return file.type === 'application/zip' || /\.zip$/i.test(file.name);
}

function inferImageType(name: string): string {
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return 'image/jpeg';
}

interface LoadedPdf {
  document: PDFDocumentProxy;
  destroy: () => Promise<void>;
}

async function pdfDocument(file: File): Promise<LoadedPdf> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  return { document: await loadingTask.promise, destroy: () => loadingTask.destroy() };
}

export async function countPdfPages(file: File): Promise<number> {
  const loaded = await pdfDocument(file);
  try {
    return loaded.document.numPages;
  } finally {
    await loaded.destroy();
  }
}

export async function expandStudentSources(files: File[], startingIndex = 0): Promise<ExpandedSources> {
  const items: QueueItem[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let originalIndex = startingIndex;

  for (const file of files) {
    if (isSupportedImage(file)) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        skipped += 1;
        warnings.push(`${file.name}: görüntü 20 MB sınırını aşıyor.`);
      } else {
        items.push({
          id: crypto.randomUUID(), sourceFile: file, sourceKind: 'image', displayName: file.name,
          originalIndex: originalIndex++, partIndex: 0, status: 'waiting',
        });
      }
      continue;
    }

    if (isPdf(file)) {
      if (file.size > MAX_PDF_SIZE_BYTES) {
        skipped += 1;
        warnings.push(`${file.name}: PDF 250 MB sınırını aşıyor.`);
        continue;
      }
      try {
        const pageCount = await countPdfPages(file);
        for (let page = 1; page <= pageCount; page += 1) {
          items.push({
            id: crypto.randomUUID(), sourceFile: file, sourceKind: 'pdf-page',
            displayName: `${file.name} · sayfa ${page}`, pdfPage: page,
            originalIndex: originalIndex++, partIndex: 0, status: 'waiting',
          });
        }
      } catch {
        skipped += 1;
        warnings.push(`${file.name}: PDF açılamadı veya parola korumalı.`);
      }
      continue;
    }

    if (isZip(file)) {
      if (file.size > MAX_ARCHIVE_SIZE_BYTES) {
        skipped += 1;
        warnings.push(`${file.name}: ZIP 250 MB sınırını aşıyor.`);
        continue;
      }
      try {
        const { default: JSZip } = await import('jszip');
        const archive = await JSZip.loadAsync(file);
        let supportedEntryCount = 0;
        for (const entry of Object.values(archive.files)) {
          if (entry.dir || !/\.(jpe?g|png|webp)$/i.test(entry.name)) continue;
          supportedEntryCount += 1;
          const declaredSize = (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
          if (typeof declaredSize === 'number' && declaredSize > MAX_FILE_SIZE_BYTES) {
            skipped += 1;
            warnings.push(`${entry.name}: ZIP girdisi 20 MB sınırını aşıyor.`);
            continue;
          }
          items.push({
            id: crypto.randomUUID(), sourceFile: file, sourceKind: 'zip-image',
            archiveEntryName: entry.name, displayName: `${file.name} / ${entry.name}`,
            originalIndex: originalIndex++, partIndex: 0, status: 'waiting',
          });
        }
        if (!supportedEntryCount) {
          skipped += 1;
          warnings.push(`${file.name}: ZIP içinde desteklenen görüntü bulunamadı.`);
        }
      } catch {
        skipped += 1;
        warnings.push(`${file.name}: ZIP açılamadı.`);
      }
      continue;
    }

    skipped += 1;
    warnings.push(`${file.name}: desteklenmeyen dosya türü.`);
  }

  return { items, skipped, warnings };
}

export function sortAndPartitionSources(items: QueueItem[], partSize: number): QueueItem[] {
  return [...items]
    .sort((left, right) => naturalCollator.compare(left.displayName, right.displayName) || left.originalIndex - right.originalIndex)
    .map((item, index) => ({ ...item, partIndex: Math.floor(index / Math.max(1, partSize)) }));
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function contentFingerprint(file: File): Promise<string> {
  const sampleSize = 64 * 1024;
  if (file.size <= 32 * 1024 * 1024) return sha256(file);
  const middle = Math.max(0, Math.floor(file.size / 2) - Math.floor(sampleSize / 2));
  const metadata = new TextEncoder().encode(`size:${file.size}`);
  return sha256(new Blob([
    metadata,
    file.slice(0, sampleSize),
    file.slice(middle, middle + sampleSize),
    file.slice(Math.max(0, file.size - sampleSize)),
  ]));
}

export class SourceMaterializer {
  private readonly pdfDocuments = new Map<File, Promise<LoadedPdf>>();
  private readonly zipArchives = new Map<File, Promise<JSZip>>();
  private readonly fileFingerprints = new Map<File, Promise<string>>();

  private getPdf(file: File): Promise<LoadedPdf> {
    const existing = this.pdfDocuments.get(file);
    if (existing) return existing;
    const created = pdfDocument(file);
    this.pdfDocuments.set(file, created);
    return created;
  }

  private getZip(file: File): Promise<JSZip> {
    const existing = this.zipArchives.get(file);
    if (existing) return existing;
    const created = import('jszip').then(({ default: JSZip }) => JSZip.loadAsync(file));
    this.zipArchives.set(file, created);
    return created;
  }

  private fileFingerprint(file: File): Promise<string> {
    const existing = this.fileFingerprints.get(file);
    if (existing) return existing;
    const created = contentFingerprint(file);
    this.fileFingerprints.set(file, created);
    return created;
  }

  async materialize(item: QueueItem): Promise<{ file: File; fingerprint: string }> {
    if (item.sourceKind === 'image') {
      return { file: item.sourceFile, fingerprint: await this.fileFingerprint(item.sourceFile) };
    }
    if (item.sourceKind === 'zip-image') {
      const archive = await this.getZip(item.sourceFile);
      const entry = item.archiveEntryName ? archive.file(item.archiveEntryName) : null;
      if (!entry) throw new Error('ZIP içindeki görüntü bulunamadı.');
      const blob = await entry.async('blob');
      if (blob.size > MAX_FILE_SIZE_BYTES) throw new Error('ZIP girdisi 20 MB sınırını aşıyor.');
      const name = item.archiveEntryName?.split('/').at(-1) || item.displayName;
      return { file: new File([blob], name, { type: inferImageType(name) }), fingerprint: await sha256(blob) };
    }
    const pageNumber = item.pdfPage ?? 1;
    const loaded = await this.getPdf(item.sourceFile);
    const page = await loaded.document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      page.cleanup();
      throw new Error('PDF sayfası için görüntü alanı oluşturulamadı.');
    }
    let blob: Blob;
    try {
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (rendered) => rendered ? resolve(rendered) : reject(new Error('PDF sayfası görsele dönüştürülemedi.')),
        'image/jpeg',
        0.95,
      ));
    } finally {
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
    const documentFingerprint = await this.fileFingerprint(item.sourceFile);
    return {
      file: new File([blob], `${item.sourceFile.name}-sayfa-${pageNumber}.jpg`, { type: 'image/jpeg' }),
      fingerprint: `${documentFingerprint}:page:${pageNumber}`,
    };
  }

  async dispose(): Promise<void> {
    const documents = await Promise.allSettled(this.pdfDocuments.values());
    await Promise.all(documents.flatMap((entry) => entry.status === 'fulfilled' ? [entry.value.destroy()] : []));
    this.pdfDocuments.clear();
    this.zipArchives.clear();
    this.fileFingerprints.clear();
  }
}

export async function materializeAnswerKey(file: File): Promise<{ file: File; dispose: () => Promise<void> }> {
  if (isSupportedImage(file)) {
    if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('Cevap anahtarı görüntüsü 20 MB sınırını aşıyor.');
    return { file, dispose: async () => undefined };
  }
  if (!isPdf(file) || file.size > MAX_PDF_SIZE_BYTES) throw new Error('Geçerli bir cevap anahtarı görüntüsü veya PDF seçin.');
  const pages = await countPdfPages(file);
  if (pages !== 1) throw new Error('Cevap anahtarı PDF dosyası tam olarak bir sayfa olmalıdır.');
  const materializer = new SourceMaterializer();
  const source: QueueItem = {
    id: crypto.randomUUID(), sourceFile: file, sourceKind: 'pdf-page', displayName: file.name,
    originalIndex: 0, pdfPage: 1, partIndex: 0, status: 'waiting',
  };
  const rendered = await materializer.materialize(source);
  return { file: rendered.file, dispose: () => materializer.dispose() };
}
