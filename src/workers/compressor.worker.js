// Web Worker for image compression using @jsquash WASM codecs
import { decode as decodeJpeg, encode as encodeJpeg } from '@jsquash/jpeg';
import { decode as decodePng, encode as encodePng } from '@jsquash/png';
import { optimise as optimisePng } from '@jsquash/oxipng';
import { decode as decodeWebp, encode as encodeWebp } from '@jsquash/webp';
import { decode as decodeAvif, encode as encodeAvif } from '@jsquash/avif';

async function decodeImage(buffer, mimeType) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return await decodeJpeg(buffer);
  }
  if (mimeType === 'image/png') {
    return await decodePng(buffer);
  }
  if (mimeType === 'image/webp') {
    return await decodeWebp(buffer);
  }
  if (mimeType === 'image/avif') {
    return await decodeAvif(buffer);
  }

  // Fallback using OffscreenCanvas and createImageBitmap
  const blob = new Blob([buffer], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return imageData;
}

self.onmessage = async (e) => {
  const { id, buffer, mimeType, targetFormat, quality, effort } = e.data;

  try {
    const startTime = performance.now();
    const originalSize = buffer.byteLength;

    // 1. Decode input buffer to raw ImageData
    const imageData = await decodeImage(buffer, mimeType);

    // 2. Encode to target format using specialized WASM codec
    let outputBuffer;
    let finalMimeType = targetFormat === 'original' ? mimeType : targetFormat;

    if (finalMimeType === 'image/jpeg' || finalMimeType === 'image/jpg') {
      outputBuffer = await encodeJpeg(imageData, {
        quality: Math.round(quality),
      });
      finalMimeType = 'image/jpeg';
    } else if (finalMimeType === 'image/png') {
      const rawPng = await encodePng(imageData);
      // Run Oxipng optimization over the encoded PNG
      outputBuffer = await optimisePng(rawPng, {
        level: Math.min(6, Math.max(1, Math.round((effort || 3)))),
      });
      finalMimeType = 'image/png';
    } else if (finalMimeType === 'image/webp') {
      outputBuffer = await encodeWebp(imageData, {
        quality: Math.round(quality),
        method: Math.min(6, Math.max(0, effort || 4)),
      });
      finalMimeType = 'image/webp';
    } else if (finalMimeType === 'image/avif') {
      outputBuffer = await encodeAvif(imageData, {
        quality: Math.round(quality),
        speed: 6, // balanced speed/compression
      });
      finalMimeType = 'image/avif';
    } else {
      throw new Error(`Unsupported output format: ${finalMimeType}`);
    }

    const compressedSize = outputBuffer.byteLength;
    const durationMs = Math.round(performance.now() - startTime);

    self.postMessage(
      {
        id,
        success: true,
        buffer: outputBuffer,
        originalSize,
        compressedSize,
        mimeType: finalMimeType,
        durationMs,
        width: imageData.width,
        height: imageData.height,
      },
      [outputBuffer] // Transferable ArrayBuffer (zero-copy)
    );
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message || 'Compression failed',
    });
  }
};
