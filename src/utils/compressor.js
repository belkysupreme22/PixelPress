export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getOutputFilename(originalName, mimeType) {
  if (!originalName) return 'optimized-image-min.png';
  const baseName = originalName.replace(/\.[^/.]+$/, "").replace(/-(min|compressed|optimized)$/i, "");
  let ext = '';
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      ext = 'jpg';
      break;
    case 'image/png':
      ext = 'png';
      break;
    case 'image/webp':
      ext = 'webp';
      break;
    case 'image/avif':
      ext = 'avif';
      break;
    default: {
      const match = originalName.match(/\.([^/.]+)$/);
      ext = match ? match[1].toLowerCase() : 'png';
      break;
    }
  }
  return `${baseName}-min.${ext}`;
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

  compress(file, { format, quality = 75, maxDimension = 0 }) {
    return new Promise(async (resolve, reject) => {
      const id = Math.random().toString(36).substring(2, 9);
      const buffer = await file.arrayBuffer();

      const task = {
        id,
        file,
        buffer,
        originalSize: file.size,
        mimeType: file.type,
        targetFormat: format,
        quality,
        maxDimension,
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

        // Anti-negative compression: if compressed size is larger than original,
        // and we are preserving format or same mime type, fallback to original.
        if (finalSize >= task.originalSize && (task.targetFormat === 'original' || e.data.mimeType === task.file.type)) {
          finalBlob = task.file;
          finalSize = task.originalSize;
        }

        const rawReduction = task.originalSize > 0 
          ? ((task.originalSize - finalSize) / task.originalSize) * 100 
          : 0;
        const reduction = Math.max(0, parseFloat(rawReduction.toFixed(1)));

        task.resolve({
          id: task.id,
          originalFile: task.file,
          originalSize: task.originalSize,
          originalUrl: URL.createObjectURL(task.file),
          originalWidth: e.data.originalWidth,
          originalHeight: e.data.originalHeight,
          origDimensions: e.data.originalWidth && e.data.originalHeight ? `${e.data.originalWidth} × ${e.data.originalHeight}` : null,
          compressedBlob: finalBlob,
          compressedSize: finalSize,
          compressedUrl: URL.createObjectURL(finalBlob),
          reductionPercentage: reduction,
          name: task.file.name,
          mimeType: finalBlob.type || e.data.mimeType,
          format: finalBlob.type || e.data.mimeType,
          durationMs: e.data.durationMs,
          width: e.data.width,
          height: e.data.height,
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
        maxDimension: task.maxDimension,
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
