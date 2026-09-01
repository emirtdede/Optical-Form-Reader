import type { FormReadResult } from '../types';

interface PendingTask {
  id: string;
  file: File;
  resolve: (result: FormReadResult) => void;
  reject: (error: Error) => void;
}

interface WorkerSlot {
  worker: Worker;
  ready: boolean;
  failed: boolean;
  active: PendingTask | null;
}

export class OmrWorkerPool {
  private readonly slots: WorkerSlot[];
  private readonly queue: PendingTask[] = [];
  private disposed = false;

  constructor(concurrency = 2) {
    const safeConcurrency = Math.min(4, Math.max(1, Math.floor(concurrency)));
    this.slots = Array.from({ length: safeConcurrency }, () => this.createSlot());
  }

  private createSlot(): WorkerSlot {
    const worker = new Worker(new URL('./omr.worker.ts', import.meta.url), { type: 'module' });
    const slot: WorkerSlot = { worker, ready: false, failed: false, active: null };

    worker.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'ready') {
        slot.ready = true;
        this.drain();
        return;
      }
      if (event.data?.type === 'init-error') {
        this.failSlot(slot, event.data?.error?.message || 'Yerel görüntü işleme motoru başlatılamadı.');
        return;
      }
      const task = slot.active;
      if (!task || event.data?.id !== task.id) return;
      slot.active = null;
      if (event.data.error) task.reject(new Error(event.data.error.message));
      else task.resolve(event.data.result as FormReadResult);
      this.drain();
    };

    worker.onerror = () => this.failSlot(slot, 'Görüntü işleme işçisi beklenmedik biçimde durdu.');
    return slot;
  }

  private failSlot(slot: WorkerSlot, message: string) {
    if (slot.failed || this.disposed) return;
    slot.failed = true;
    slot.ready = false;
    slot.active?.reject(new Error(message));
    slot.active = null;
    slot.worker.terminate();

    if (this.slots.every((candidate) => candidate.failed)) {
      this.queue.splice(0).forEach((task) => task.reject(new Error(message)));
    } else {
      this.drain();
    }
  }

  process(file: File): Promise<FormReadResult> {
    if (this.disposed) return Promise.reject(new Error('İşlem kuyruğu kapatıldı.'));
    return new Promise((resolve, reject) => {
      this.queue.push({ id: crypto.randomUUID(), file, resolve, reject });
      this.drain();
    });
  }

  private drain() {
    if (this.disposed) return;
    this.slots.forEach((slot) => {
      if (slot.failed || !slot.ready || slot.active || !this.queue.length) return;
      const task = this.queue.shift();
      if (!task) return;
      slot.active = task;
      slot.worker.postMessage({ id: task.id, file: task.file });
    });
  }

  dispose(reason = 'İşlem kullanıcı tarafından durduruldu.') {
    this.disposed = true;
    this.queue.splice(0).forEach((task) => task.reject(new Error(reason)));
    this.slots.forEach((slot) => {
      slot.active?.reject(new Error(reason));
      slot.worker.terminate();
    });
  }
}
