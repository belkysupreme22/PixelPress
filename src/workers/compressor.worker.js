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

function resizeImageData(imgData, maxDimension) {
  if (!maxDimension || maxDimension <= 0) return imgData;
  const { width, height } = imgData;
  if (width <= maxDimension && height <= maxDimension) return imgData;

  let targetWidth = width;
  let targetHeight = height;
  if (width >= height) {
    targetWidth = maxDimension;
    targetHeight = Math.max(1, Math.round((height * maxDimension) / width));
  } else {
    targetHeight = maxDimension;
    targetWidth = Math.max(1, Math.round((width * maxDimension) / height));
  }

  const srcCanvas = new OffscreenCanvas(width, height);
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.putImageData(imgData, 0, 0);

  const dstCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const dstCtx = dstCanvas.getContext('2d');
  dstCtx.imageSmoothingEnabled = true;
  dstCtx.imageSmoothingQuality = 'high';
  dstCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

  return dstCtx.getImageData(0, 0, targetWidth, targetHeight);
}

self.onmessage = async (e) => {
  const { id, buffer, mimeType, targetFormat, quality, maxDimension } = e.data;

  try {
    const startTime = performance.now();
    const originalSize = buffer.byteLength;

    // 1. Decode input buffer to raw ImageData
    const rawDecoded = await decodeImage(buffer, mimeType);
    const originalWidth = rawDecoded.width;
    const originalHeight = rawDecoded.height;

    // 2. High-quality bicubic downscale if maxDimension is specified
    const imageData = resizeImageData(rawDecoded, maxDimension);

    // 3. Encode to target format using specialized WASM codec
    let outputBuffer;
    let finalMimeType = targetFormat === 'original' ? mimeType : targetFormat;

    if (finalMimeType === 'image/jpeg' || finalMimeType === 'image/jpg') {
      // JPEG has no alpha channel. If input has transparency (e.g. PNG cutout),
      // composite transparent and semi-transparent pixels onto a clean white (#FFFFFF) background
      // to prevent black backgrounds or dirty residual background artifacts.
      let jpegInputData = imageData;
      const data = imageData.data;
      let hasAlpha = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
          hasAlpha = true;
          break;
        }
      }

      if (hasAlpha) {
        const opaqueData = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          if (a === 1) {
            opaqueData[i] = data[i];
            opaqueData[i + 1] = data[i + 1];
            opaqueData[i + 2] = data[i + 2];
            opaqueData[i + 3] = 255;
          } else if (a === 0) {
            opaqueData[i] = 255;
            opaqueData[i + 1] = 255;
            opaqueData[i + 2] = 255;
            opaqueData[i + 3] = 255;
          } else {
            opaqueData[i] = Math.round(data[i] * a + 255 * (1 - a));
            opaqueData[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
            opaqueData[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
            opaqueData[i + 3] = 255;
          }
        }
        jpegInputData = {
          width: imageData.width,
          height: imageData.height,
          data: opaqueData,
        };
      }

      outputBuffer = await encodeJpeg(jpegInputData, {
        quality: Math.round(quality),
      });
      finalMimeType = 'image/jpeg';
    } else if (finalMimeType === 'image/png') {
      const rawPng = await encodePng(imageData);
      // Level 2 is the official recommended sweet spot for OxiPNG
      outputBuffer = await optimisePng(rawPng, {
        level: 2,
      });
      finalMimeType = 'image/png';
    } else if (finalMimeType === 'image/webp') {
      outputBuffer = await encodeWebp(imageData, {
        quality: Math.round(quality),
        method: 4,
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
        originalWidth,
        originalHeight,
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
