export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

class CompressionWorkerPool {
  constructor(size = 2) {
    this.size = size;
    this.workers = [];
    this.queue = [];
    this.activeWorkers = new Set();
  }

  getWorker() {
    if (typeof window === 'undefined') return null;

    if (this.workers.length < this.size) {
      const worker = new Worker(
        new URL('../workers/compressor.worker.js', import.meta.url),
        { type: 'module' }
      );
      this.workers.push(worker);
      return worker;
    }

    // Find an idle worker
    const idleWorker = this.workers.find(w => !this.activeWorkers.has(w));
    return idleWorker || null;
  }

  compress(file, { format, quality = 75, effort = 4 }) {
    return new Promise(async (resolve, reject) => {
      const id = Math.random().toString(36).substring(2, 9);
      const buffer = await file.arrayBuffer();

      const task = {
        id,
        file,
        buffer,
        mimeType: file.type,
        targetFormat: format,
        quality,
        effort,
        resolve,
        reject,
      };

      this.scheduleTask(task);
    });
  }

  scheduleTask(task) {
    const worker = this.getWorker();

    if (!worker) {
      this.queue.push(task);
      return;
    }

    this.activeWorkers.add(worker);

    const onMessage = (e) => {
      if (e.data.id !== task.id) return;

      worker.removeEventListener('message', onMessage);
      this.activeWorkers.delete(worker);

      // Process next item in queue
      if (this.queue.length > 0) {
        const nextTask = this.queue.shift();
        this.scheduleTask(nextTask);
      }

      if (e.data.success) {
        let finalBlob = new Blob([e.data.buffer], { type: e.data.mimeType });
        let finalSize = e.data.compressedSize;

        // Anti-negative compression fallback if same format and size grew
        if (e.data.mimeType === task.file.type && finalSize >= task.originalSize) {
          finalBlob = task.file;
          finalSize = task.file.size;
        }

        const reduction = ((task.originalSize - finalSize) / task.originalSize) * 100;

        task.resolve({
          id: task.id,
          originalFile: task.file,
          originalSize: task.originalSize,
          compressedBlob: finalBlob,
          compressedSize: finalSize,
          compressedUrl: URL.createObjectURL(finalBlob),
          reductionPercentage: Math.max(0, reduction),
          name: task.file.name,
          durationMs: e.data.durationMs,
          dimensions: `${e.data.width} × ${e.data.height}`,
          status: 'done',
        });
      } else {
        task.resolve({
          id: task.id,
          originalFile: task.file,
          originalSize: task.file.size,
          name: task.file.name,
          status: 'error',
          error: e.data.error,
        });
      }
    };

    worker.addEventListener('message', onMessage);

    // Send task with transferable ArrayBuffer
    worker.postMessage(
      {
        id: task.id,
        buffer: task.buffer,
        mimeType: task.mimeType,
        targetFormat: task.targetFormat,
        quality: task.quality,
        effort: task.effort,
      },
      [task.buffer]
    );
  }
}

// Global worker pool singleton
let poolInstance = null;

export function getWorkerPool() {
  if (!poolInstance && typeof window !== 'undefined') {
    const concurrency = Math.min(4, Math.max(2, navigator.hardwareConcurrency ? Math.floor(navigator.hardwareConcurrency / 2) : 2));
    poolInstance = new CompressionWorkerPool(concurrency);
  }
  return poolInstance;
}

export async function compressImage(file, options) {
  const pool = getWorkerPool();
  if (pool) {
    return await pool.compress(file, options);
  }
  throw new Error('Worker pool unavailable in current environment');
}
