"use client";

import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { 
  Cpu, 
  Upload, 
  Download, 
  Trash2, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Zap, 
  ShieldCheck, 
  FileCode,
  ArrowRight
} from 'lucide-react';
import styles from './page.module.css';
import { compressImage, formatBytes } from '../utils/compressor';

export default function Home() {
  const [images, setImages] = useState([]);
  const [format, setFormat] = useState('original');
  const [quality, setQuality] = useState(75);
  const [effort, setEffort] = useState(4);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasRefusal, setHasRefusal] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-compress a single image
  const compressSingle = async (imgItem, targetFormat, targetQuality, targetEffort) => {
    try {
      const result = await compressImage(imgItem.originalFile, {
        format: targetFormat,
        quality: targetQuality,
        effort: targetEffort,
      });

      setImages(prev => prev.map(item => {
        if (item.id !== imgItem.id) return item;
        return {
          ...item,
          ...result,
          originalSize: item.originalSize || result.originalSize || item.originalFile.size,
          id: item.id,
          status: 'done',
        };
      }));
    } catch (err) {
      setImages(prev => prev.map(item => {
        if (item.id !== imgItem.id) return item;
        return {
          ...item,
          status: 'error',
          error: err.message || 'Compression failed',
        };
      }));
    }
  };

  // Auto-compress on upload / drop
  const handleFiles = (files) => {
    const rawList = Array.from(files);
    const validFiles = rawList.filter(f => 
      f.type.match(/^image\/(jpeg|png|webp|avif)$/)
    );

    if (rawList.length > 0 && validFiles.length === 0) {
      setHasRefusal(true);
      setTimeout(() => setHasRefusal(false), 500);
      return;
    }

    const newItems = validFiles.map(f => ({
      id: Math.random().toString(36).substring(2, 9),
      originalFile: f,
      originalSize: f.size || 0,
      name: f.name,
      status: 'compressing', // starts automatically!
    }));

    setImages(prev => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Immediately trigger WASM workers for each image
    newItems.forEach(item => {
      compressSingle(item, format, quality, effort);
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // Recompress all images when settings change or user clicks Recompress
  const handleRecompressAll = async (targetFmt = format, targetQ = quality, targetEff = effort) => {
    if (images.length === 0) return;
    setIsCompressing(true);

    // Set all to compressing
    setImages(prev => prev.map(img => ({ ...img, status: 'compressing' })));

    await Promise.all(
      images.map(img => compressSingle(img, targetFmt, targetQ, targetEff))
    );

    setIsCompressing(false);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const completed = images.filter(img => img.status === 'done' && img.compressedBlob);

    completed.forEach(img => {
      let finalName = img.name;
      if (format !== 'original') {
        const ext = format === 'image/jpeg' ? '.jpg' : 
                    format === 'image/png' ? '.png' : 
                    format === 'image/webp' ? '.webp' : '.avif';
        finalName = img.name.replace(/\.[^/.]+$/, "") + ext;
      }
      zip.file(finalName, img.compressedBlob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'pixelpress_optimized.zip';
    link.click();
  };

  const handleClear = () => {
    images.forEach(img => {
      if (img.compressedUrl) URL.revokeObjectURL(img.compressedUrl);
    });
    setImages([]);
  };

  const removeImage = (id) => {
    const item = images.find(img => img.id === id);
    if (item?.compressedUrl) {
      URL.revokeObjectURL(item.compressedUrl);
    }
    setImages(images.filter(img => img.id !== id));
  };

  // Safe numerical stats calculation - NO NaN, NO negative values
  const totalOrig = images.reduce((acc, img) => acc + (typeof img.originalSize === 'number' && !isNaN(img.originalSize) ? img.originalSize : 0), 0);
  const totalOpt = images.reduce((acc, img) => {
    const optSize = typeof img.compressedSize === 'number' && !isNaN(img.compressedSize) ? img.compressedSize : img.originalSize;
    return acc + (typeof optSize === 'number' && !isNaN(optSize) ? optSize : 0);
  }, 0);
  const totalSaved = Math.max(0, totalOrig - totalOpt);
  const savedPercent = totalOrig > 0 && totalSaved > 0 ? Math.round((totalSaved / totalOrig) * 100) : 0;

  // Stepper flow indicator
  const anyCompressing = images.some(i => i.status === 'compressing');
  const allDone = images.length > 0 && images.every(i => i.status === 'done');
  const currentStep = images.length === 0 ? 1 : anyCompressing ? 2 : 3;

  return (
    <>
      {/* 44px Sticky Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Cpu className={styles.brandIcon} />
            <span className={styles.brandName}>PixelPress</span>
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
              <span className={styles.pulseDot} />
              WASM Engine
            </span>
          </div>

          <div className={styles.headerMeta}>
            <span className={styles.badge}>
              <ShieldCheck size={12} />
              Zero telemetry · 100% device local
            </span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Step-by-step progress guide: 01 Import -> 02 Optimize -> 03 Export */}
        <nav aria-label="Pipeline Steps" className={styles.stepperBar}>
          <div className={`${styles.stepItem} ${currentStep === 1 ? styles.stepItemActive : styles.stepItemComplete}`}>
            <span className={styles.stepIndex}>01</span>
            <span className={styles.stepLabel}>Import Images</span>
          </div>
          <div className={`${styles.stepItem} ${currentStep === 2 ? styles.stepItemActive : currentStep > 2 ? styles.stepItemComplete : ''}`}>
            <span className={styles.stepIndex}>02</span>
            <span className={styles.stepLabel}>
              {anyCompressing ? 'Optimizing with WASM...' : 'Auto-Optimized'}
            </span>
          </div>
          <div className={`${styles.stepItem} ${currentStep === 3 ? styles.stepItemActive : ''}`}>
            <span className={styles.stepIndex}>03</span>
            <span className={styles.stepLabel}>Download & Export</span>
          </div>
        </nav>

        {/* Hero Section */}
        <div className={styles.hero}>
          <div className={styles.heroTag}>
            <Zap size={12} color="var(--accent)" />
            MozJPEG · OxiPNG · LibWebP · LibAOM
          </div>

          <div className={styles.terminalCommandBar}>
            <span className={styles.terminalPrefix}>pixelpress $</span>
            <span className={styles.terminalText}>wasm-opt --simd</span>
            <span className={styles.terminalCursor} />
          </div>

          <h1 className={styles.heroTitle}>
            Real image compression. Zero cloud.
          </h1>
          <p className={styles.heroDesc}>
            Native C and Rust codecs compiled to WebAssembly. Drop your images to optimize instantly in memory without sending private files to third-party servers.
          </p>
        </div>

        {/* Telemetry Bento / Value Metrics */}
        <section className={styles.marketingBento}>
          <article className={styles.bentoCard}>
            <div className={styles.bentoHeader}>
              <span className={styles.bentoTitle}><Cpu size={14} /> MozJPEG Trellis</span>
              <span className={styles.bentoStat}>-30%</span>
            </div>
            <p className={styles.bentoDesc}>
              Custom Huffman trees and Viterbi coefficient rounding outperform basic canvas encoders.
            </p>
          </article>

          <article className={styles.bentoCard}>
            <div className={styles.bentoHeader}>
              <span className={styles.bentoTitle}><Zap size={14} /> Rust OxiPNG</span>
              <span className={styles.bentoStat}>-65%</span>
            </div>
            <p className={styles.bentoDesc}>
              Dynamic row filtering and brute-force DEFLATE optimization for lossless transparency.
            </p>
          </article>

          <article className={styles.bentoCard}>
            <div className={styles.bentoHeader}>
              <span className={styles.bentoTitle}><ShieldCheck size={14} /> Private Memory</span>
              <span className={styles.bentoStat}>0 KB</span>
            </div>
            <p className={styles.bentoDesc}>
              Runs inside sandboxed Web Workers with zero server network calls or tracking pixels.
            </p>
          </article>
        </section>

        {/* Controls Panel */}
        <div className={styles.controlsPanel}>
          <div className={styles.controlsRow}>
            <div className={styles.controlsGroup}>
              <div className={styles.field}>
                <span>Target:</span>
                <select 
                  className={styles.select}
                  value={format} 
                  onChange={e => {
                    const newFmt = e.target.value;
                    setFormat(newFmt);
                    if (images.length > 0) handleRecompressAll(newFmt, quality, effort);
                  }}
                >
                  <option value="original">Original (Preserve)</option>
                  <option value="image/webp">WebP (Modern)</option>
                  <option value="image/jpeg">MozJPEG (Trellis)</option>
                  <option value="image/png">OxiPNG (Optimized)</option>
                  <option value="image/avif">AVIF (Ultra small)</option>
                </select>
              </div>

              {format !== 'image/png' && (
                <div className={styles.field}>
                  <span>Quality:</span>
                  <div className={styles.rangeWrap}>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={quality} 
                      onChange={e => setQuality(Number(e.target.value))}
                      onMouseUp={() => { if (images.length > 0) handleRecompressAll(format, quality, effort); }}
                      onTouchEnd={() => { if (images.length > 0) handleRecompressAll(format, quality, effort); }}
                      className={styles.rangeInput}
                    />
                    <span className={styles.rangeVal}>{quality}</span>
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <span>Effort:</span>
                <div className={styles.rangeWrap}>
                  <input 
                    type="range" 
                    min="1" 
                    max="6" 
                    value={effort} 
                    onChange={e => setEffort(Number(e.target.value))}
                    onMouseUp={() => { if (images.length > 0) handleRecompressAll(format, quality, effort); }}
                    onTouchEnd={() => { if (images.length > 0) handleRecompressAll(format, quality, effort); }}
                    className={styles.rangeInput}
                  />
                  <span className={styles.rangeVal}>{effort}</span>
                </div>
              </div>
            </div>

            <div className={styles.actionButtons}>
              <button 
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} /> Add files
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                accept="image/jpeg, image/png, image/webp, image/avif" 
                className="visually-hidden" 
                onChange={(e) => handleFiles(e.target.files)} 
              />
              {images.length > 0 && (
                <button 
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={anyCompressing}
                  onClick={() => handleRecompressAll()}
                  title="Re-run compression with current parameters"
                >
                  <RefreshCw size={14} className={anyCompressing ? styles.spinnerSmall : ''} />
                  {anyCompressing ? 'Optimizing...' : 'Recompress'}
                </button>
              )}
              <button 
                className={`${styles.btn} ${allDone ? styles.btnActionHighlight : styles.btnSecondary}`}
                disabled={!images.some(i => i.status === 'done')}
                onClick={handleDownloadAll}
              >
                <Download size={14} /> Export ZIP
              </button>
              <button 
                className={`${styles.btn} ${styles.btnGhost}`}
                disabled={images.length === 0}
                onClick={handleClear}
              >
                <Trash2 size={14} /> Clear
              </button>
            </div>
          </div>
        </div>

        {/* Drop Zone */}
        {images.length === 0 ? (
          <div 
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneDrag : ''} ${hasRefusal ? styles.refusalShake : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={styles.dropIcon} />
            <div className={styles.dropTitle}>Drop images here to compress immediately</div>
            <div className={styles.dropSubtitle}>Automatic WASM optimization · JPEG, PNG, WebP, AVIF</div>
          </div>
        ) : (
          <div className={styles.listContainer}>
            <div className={styles.listHeader}>
              <span>Queue ({images.length} {images.length === 1 ? 'file' : 'files'})</span>
              <div className={styles.statsCluster}>
                <div className={styles.statItem}>
                  <span>Original:</span>
                  <span className={styles.statNumber}>{formatBytes(totalOrig)}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Optimized:</span>
                  <span className={styles.statNumber}>{formatBytes(totalOpt)}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Saved:</span>
                  <span className={`${styles.statNumber} ${styles.statAccent}`}>
                    {formatBytes(totalSaved)} ({savedPercent}%)
                  </span>
                </div>
              </div>
            </div>

            {images.map(img => (
              <div key={img.id} className={styles.itemCard}>
                <div className={styles.thumbWrap}>
                  {img.compressedUrl ? (
                    <img src={img.compressedUrl} alt="preview" />
                  ) : (
                    <img src={URL.createObjectURL(img.originalFile)} alt="preview" />
                  )}
                </div>

                <div className={styles.itemDetails}>
                  <div className={styles.itemName} title={img.name}>{img.name}</div>
                  <div className={styles.itemMeta}>
                    <span>{img.dimensions || 'Measuring...'}</span>
                    <span>·</span>
                    {img.status === 'compressing' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
                        <span className={styles.spinnerSmall} />
                        Compressing with WASM...
                      </span>
                    ) : img.durationMs ? (
                      <span>Completed in {img.durationMs}ms</span>
                    ) : (
                      <span>Ready</span>
                    )}
                    {img.status === 'error' && (
                      <span style={{ color: 'var(--error)' }}>Failed: {img.error}</span>
                    )}
                  </div>
                </div>

                <div className={styles.itemTelemetry}>
                  <div className={styles.telemetryOrig}>
                    {formatBytes(img.originalSize || img.originalFile?.size || 0)}
                  </div>
                  {img.compressedSize ? (
                    <div className={styles.telemetryOpt}>
                      {formatBytes(img.compressedSize)}
                    </div>
                  ) : null}
                  {img.status === 'done' && (
                    <span className={`${styles.reductionTag} ${img.reductionPercentage <= 0 ? styles.reductionTagNeutral : ''}`}>
                      {img.reductionPercentage > 0 
                        ? `-${img.reductionPercentage.toFixed(1)}%` 
                        : 'Optimal (Original kept)'}
                    </span>
                  )}
                </div>

                <div className={styles.itemActions}>
                  {img.status === 'done' && (
                    <a 
                      href={img.compressedUrl} 
                      download={img.name}
                      className={`${styles.actionIconBtn} ${styles.btnActionHighlight}`}
                      title="Download optimized file"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  <button 
                    className={`${styles.actionIconBtn} ${styles.actionIconBtnDanger}`}
                    onClick={() => removeImage(img.id)}
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Technical Architecture Strip */}
        <section className={styles.engineStrip}>
          <div className={styles.engineCard}>
            <div className={styles.engineCardTitle}>
              <Cpu size={14} /> MozJPEG Engine
            </div>
            <div className={styles.engineCardDesc}>
              Trellis quantization and per-image Huffman entropy optimization compiled to WebAssembly.
            </div>
          </div>

          <div className={styles.engineCard}>
            <div className={styles.engineCardTitle}>
              <Zap size={14} /> OxiPNG Optimizer
            </div>
            <div className={styles.engineCardDesc}>
              Multi-threaded Rust DEFLATE optimizer testing dynamic row filter combinations.
            </div>
          </div>

          <div className={styles.engineCard}>
            <div className={styles.engineCardTitle}>
              <FileCode size={14} /> Web Workers
            </div>
            <div className={styles.engineCardDesc}>
              Zero-copy ArrayBuffer transfers running outside the main thread to ensure 60fps UI responsiveness.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
