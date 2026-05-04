export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function compressImage(file, { format, quality }) {
  try {
    // 1. Decode the image into a bitmap
    const bitmap = await createImageBitmap(file);

    // 2. Paint it onto an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);

    // 3. Re-encode using target format & quality
    const mimeType = format === 'original' ? file.type : format;
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, mimeType, quality / 100);
    });

    if (!blob) throw new Error("Canvas toBlob failed");

    // If the re-encoded image is larger than the original AND we haven't 
    // changed the file format, we should just use the original file.
    // This prevents "negative compression" when uploading already-optimized files.
    let finalBlob = blob;
    if (mimeType === file.type && blob.size >= file.size) {
      finalBlob = file; // Fallback to original
    }

    const reduction = ((file.size - finalBlob.size) / file.size) * 100;

    return {
      id: Math.random().toString(36).substring(2, 9),
      originalFile: file,
      originalSize: file.size,
      compressedBlob: finalBlob,
      compressedSize: finalBlob.size,
      compressedUrl: URL.createObjectURL(finalBlob),
      reductionPercentage: reduction,
      name: file.name,
      status: 'done' // 'pending' | 'compressing' | 'done' | 'error'
    };
  } catch (error) {
    console.error("Compression failed:", error);
    return {
      id: Math.random().toString(36).substring(2, 9),
      originalFile: file,
      originalSize: file.size,
      name: file.name,
      status: 'error',
      error: error.message
    };
  }
}
