"use client";

import { useState, useRef, useCallback } from 'react';
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
  Lock,
  Layers,
  HelpCircle,
  Archive,
  Info,
  ArrowRight
} from 'lucide-react';
import styles from './page.module.css';
import { compressImage, formatBytes } from '../utils/compressor';
import FlickeringGrid from '../components/FlickeringGrid';
import Tooltip from '../components/Tooltip';
import ToastContainer from '../components/Toast';

export default function Home() {
  const [images, setImages] = useState([]);
  const [format, setFormat] = useState('original');
  const [quality, setQuality] = useState(75);
  const [effort, setEffort] = useState(4);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasRefusal, setHasRefusal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [activeBottomTab, setActiveBottomTab] = useState('compare'); // 'compare' | 'faq' | 'about'
  const fileInputRef = useRef(null);

  // Toast notification dispatcher
  const notify = useCallback((title, message, type = 'info', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

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

      // Notify completion
      const savedText = result.reductionPercentage > 0 
        ? `${result.reductionPercentage.toFixed(1)}% smaller` 
        : 'already optimal';
      notify('Optimization complete', `${imgItem.name} is ${savedText}`, 'success');
    } catch (err) {
      setImages(prev => prev.map(item => {
        if (item.id !== imgItem.id) return item;
        return {
          ...item,
          status: 'error',
          error: err.message || 'Compression failed',
        };
      }));
      notify('Compression error', `Failed to process ${imgItem.name}`, 'error');
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
      notify('Unsupported format', 'Please upload PNG, JPEG, WebP, or AVIF files.', 'error');
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

    notify('Processing started', `Optimizing ${newItems.length} ${newItems.length === 1 ? 'file' : 'files'} in background`, 'info');

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

    notify('Recomputing queue', `Applying new codec & quality parameters`, 'info');
    setImages(prev => prev.map(img => ({ ...img, status: 'compressing' })));

    await Promise.all(
      images.map(img => compressSingle(img, targetFmt, targetQ, targetEff))
    );

    setIsCompressing(false);
  };

  // Single download trigger
  const handleDownloadSingle = (img) => {
    notify('Download started', `Downloading ${img.name}`, 'download');
  };

  const handleDownloadAll = async () => {
    const completed = images.filter(img => img.status === 'done' && img.compressedBlob);
    if (completed.length === 0) return;

    notify('Preparing archive', `Packaging ${completed.length} optimized files into ZIP...`, 'info', 2000);

    const zip = new JSZip();
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

    notify('Download complete', 'Saved pixelpress_optimized.zip to your downloads', 'download');
  };

  const handleClear = () => {
    images.forEach(img => {
      if (img.compressedUrl) URL.revokeObjectURL(img.compressedUrl);
    });
    setImages([]);
    notify('Queue cleared', 'Workspace reset and memory released', 'clear');
  };

  const removeImage = (id) => {
    const item = images.find(img => img.id === id);
    if (item?.compressedUrl) {
      URL.revokeObjectURL(item.compressedUrl);
    }
    setImages(images.filter(img => img.id !== id));
    if (item) {
      notify('Removed', `Removed ${item.name} from queue`, 'info', 2000);
    }
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
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 44px Sticky Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Cpu className={styles.brandIcon} />
            <span className={styles.brandName}>PixelPress</span>
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
              <span className={styles.pulseDot} />
              WASM Core
            </span>
          </div>

          <div className={styles.headerMeta}>
            <span className={styles.badge}>
              <ShieldCheck size={12} />
              100% Private · Runs in your browser
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
              {anyCompressing ? 'Optimizing in Background...' : 'Optimized in Memory'}
            </span>
          </div>
          <div className={`${styles.stepItem} ${currentStep === 3 ? styles.stepItemActive : ''}`}>
            <span className={styles.stepIndex}>03</span>
            <span className={styles.stepLabel}>Download & Export</span>
          </div>
        </nav>

        {/* Hero Section with FarmJS Flickering Canvas Simulation */}
        <div className={styles.hero}>
          <div className={styles.heroFlickerWrap}>
            <FlickeringGrid 
              squareSize={3}
              gridGap={5}
              flickerChance={0.2}
              maxOpacity={0.22}
            />
          </div>

          <div className={styles.heroContent}>
            <div className={styles.heroTag}>
              <Zap size={12} color="var(--accent)" />
              MozJPEG · OxiPNG · LibWebP · LibAOM
            </div>

            <div className={styles.terminalCommandBar}>
              <span className={styles.terminalPrefix}>pixelpress $</span>
              <span className={styles.terminalText}>build --codecs=all --threads=max</span>
              <span className={styles.terminalCursor} />
            </div>

            <h1 className={styles.heroTitle}>
              Crush image payloads. Zero server footprint.
            </h1>
            <p className={styles.heroDesc}>
              The high-performance compression engine engineered for modern web teams. Native Rust and C codecs compiled to WebAssembly run directly inside private browser memory — slashing payloads by up to 80% without leaking a single byte over the wire.
            </p>
          </div>
        </div>

        {/* Telemetry Bento / Value Metrics */}
        <section className={styles.marketingBento}>
          <article className={styles.bentoCard}>
            <div className={styles.bentoHeader}>
              <span className={styles.bentoTitle}><Cpu size={14} /> Trellis Quantization</span>
              <span className={styles.bentoStat}>Up to 80% Smaller</span>
            </div>
            <p className={styles.bentoDesc}>
              MozJPEG dynamic Viterbi coefficient paths and optimized Huffman trees squeeze file sizes browser canvas encoders can't touch.
            </p>
          </article>

          <article className={styles.bentoCard}>
            <div className={styles.bentoHeader}>
              <span className={styles.bentoTitle}><Zap size={14} /> Zero Network Latency</span>
              <span className={styles.bentoStat}>0.0ms Upload Time</span>
            </div>
            <p className={styles.bentoDesc}>
              No waiting for 50MB files to upload to a remote API. Every byte is transformed in parallel across local CPU worker threads.
            </p>
          </article>

          <article className={styles.bentoCard}>
            <div className={styles.bentoHeader}>
              <span className={styles.bentoTitle}><ShieldCheck size={14} /> Air-Gapped Privacy</span>
              <span className={styles.bentoStat}>100% Client-Side</span>
            </div>
            <p className={styles.bentoDesc}>
              Strict zero-trust media processing. Production assets, internal mockups, and sensitive photography never leave your local device.
            </p>
          </article>
        </section>

        {/* Controls Panel */}
        <div className={styles.controlsPanel}>
          <div className={styles.controlsRow}>
            <div className={styles.controlsGroup}>
              <div className={styles.field}>
                <span>Target Codec:</span>
                <Tooltip 
                  showIcon={true}
                  label="Target Codec" 
                  content="Output format: WebP is best for modern web, MozJPEG for photos, OxiPNG for graphics with transparency, AVIF for highest compression."
                  position="top"
                />
                <select 
                  className={styles.select}
                  value={format} 
                  onChange={e => {
                    const newFmt = e.target.value;
                    setFormat(newFmt);
                    if (images.length > 0) handleRecompressAll(newFmt, quality, effort);
                  }}
                >
                  <option value="original">Original (Smart Fallback)</option>
                  <option value="image/webp">WebP (Next-Gen Standard)</option>
                  <option value="image/jpeg">MozJPEG (Trellis Photographic)</option>
                  <option value="image/png">OxiPNG (Lossless Rust DEFLATE)</option>
                  <option value="image/avif">AVIF (Ultra-Density AV1)</option>
                </select>
              </div>

              {format !== 'image/png' && (
                <div className={styles.field}>
                  <span>Fidelity:</span>
                  <Tooltip 
                    showIcon={true}
                    label="Image Fidelity" 
                    content="Compression quality (1–100%). 75% delivers small file sizes with virtually zero noticeable loss to the human eye."
                    position="top"
                  />
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
                    <span className={styles.rangeVal}>{quality}%</span>
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <span>Passes:</span>
                <Tooltip 
                  showIcon={true}
                  label="Encoder Passes" 
                  content="Optimization effort (1–6). Higher passes test more DEFLATE filters and Huffman combinations to squeeze extra kilobytes."
                  position="top"
                />
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
                title="Browse and select images from your device"
              >
                <Upload size={14} /> Stage files
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
                  {anyCompressing ? 'Computing...' : 'Recompute'}
                </button>
              )}
              <button 
                className={`${styles.btn} ${allDone ? styles.btnActionHighlight : styles.btnSecondary}`}
                disabled={!images.some(i => i.status === 'done')}
                onClick={handleDownloadAll}
                title="Bundle all optimized images into a single ZIP archive"
              >
                <Download size={14} /> Export ZIP
              </button>
              <button 
                className={`${styles.btn} ${styles.btnGhost}`}
                disabled={images.length === 0}
                onClick={handleClear}
                title="Clear all queued images and free allocated browser memory"
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
            <div className={styles.dropZoneGridWrap}>
              <FlickeringGrid 
                squareSize={2}
                gridGap={6}
                flickerChance={0.3}
                maxOpacity={0.16}
              />
            </div>
            <div className={styles.dropZoneContent}>
              <Upload className={styles.dropIcon} />
              <div className={styles.dropTitle}>Drop images to optimize at memory speed</div>
              <div className={styles.dropSubtitle}>Unlimited batch processing · JPEG, PNG, WebP & AVIF · Up to 100MB+ per file</div>
              <div className={styles.dropZoneBadges}>
                <span className={styles.dropZoneBadgeItem}>
                  <Zap size={11} color="var(--accent)" /> Instant WASM Compute
                </span>
                <span className={styles.dropZoneBadgeItem}>
                  <ShieldCheck size={11} color="var(--accent)" /> 100% Local Sandbox
                </span>
                <span className={styles.dropZoneBadgeItem}>
                  <Archive size={11} color="var(--accent)" /> One-Click ZIP Export
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.listContainer}>
            <div className={styles.listHeader}>
              <span>Optimized Images ({images.length} {images.length === 1 ? 'file' : 'files'})</span>
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
                    {formatBytes(totalSaved)} ({savedPercent}% smaller)
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
                        Computing in background worker...
                      </span>
                    ) : img.durationMs ? (
                      <span>Transformed in {img.durationMs}ms</span>
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
                    <span 
                      className={`${styles.reductionTag} ${img.reductionPercentage <= 0 ? styles.reductionTagNeutral : ''}`}
                      title={`Original: ${formatBytes(img.originalSize)} → Compressed: ${formatBytes(img.compressedSize)}`}
                    >
                      {img.reductionPercentage > 0 
                        ? `${img.reductionPercentage.toFixed(1)}% smaller` 
                        : 'Optimal (Original kept)'}
                    </span>
                  )}
                </div>

                <div className={styles.itemActions}>
                  {img.status === 'done' && (
                    <a 
                      href={img.compressedUrl} 
                      download={img.name}
                      onClick={() => handleDownloadSingle(img)}
                      className={`${styles.actionIconBtn} ${styles.btnActionHighlight}`}
                      title="Download this optimized image"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  <button 
                    className={`${styles.actionIconBtn} ${styles.actionIconBtnDanger}`}
                    onClick={() => removeImage(img.id)}
                    title="Remove this image from queue"
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

        {/* Knowledge Base Section: Tabbed Switcher (Comparison Matrix / FAQ / About) */}
        <section className={styles.knowledgeSection}>
          <div className={styles.knowledgeHeader}>
            <div className={styles.knowledgeTitleGroup}>
              <h2 className={styles.knowledgeTitle}>Architecture & Knowledge Base</h2>
              <p className={styles.knowledgeSubtitle}>Learn how PixelPress operates, compare codecs, and explore frequently asked questions.</p>
            </div>

            <div className={styles.knowledgeTabs} role="tablist">
              <button 
                className={`${styles.tabBtn} ${activeBottomTab === 'compare' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveBottomTab('compare')}
                role="tab"
                aria-selected={activeBottomTab === 'compare'}
              >
                <Layers size={13} /> Comparison Matrix
              </button>
              <button 
                className={`${styles.tabBtn} ${activeBottomTab === 'faq' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveBottomTab('faq')}
                role="tab"
                aria-selected={activeBottomTab === 'faq'}
              >
                <HelpCircle size={13} /> FAQ
              </button>
              <button 
                className={`${styles.tabBtn} ${activeBottomTab === 'about' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveBottomTab('about')}
                role="tab"
                aria-selected={activeBottomTab === 'about'}
              >
                <ShieldCheck size={13} /> Security & Specs
              </button>
            </div>
          </div>

          {/* TAB 1: Comparison Matrix */}
          {activeBottomTab === 'compare' && (
            <div className={styles.matrixTableWrap}>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th>Architecture Dimension</th>
                    <th style={{ color: 'var(--accent)' }}>PixelPress (WASM)</th>
                    <th>Cloud APIs (TinyPNG, etc.)</th>
                    <th>Browser Canvas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.matrixFeatureCol}>Data Privacy</td>
                    <td className={styles.matrixWinnerCell}>100% In-Memory Local Sandbox</td>
                    <td>Sent to remote cloud servers</td>
                    <td>Local</td>
                  </tr>
                  <tr>
                    <td className={styles.matrixFeatureCol}>Compression Engine</td>
                    <td className={styles.matrixWinnerCell}>MozJPEG, OxiPNG, WebP & AVIF</td>
                    <td>Server-side CLI binaries</td>
                    <td>Basic browser canvas.toBlob</td>
                  </tr>
                  <tr>
                    <td className={styles.matrixFeatureCol}>Batch & File Limits</td>
                    <td className={styles.matrixWinnerCell}>Unlimited batch drops · 100MB+</td>
                    <td>5MB hard cap or paid subscription</td>
                    <td>Memory-constrained</td>
                  </tr>
                  <tr>
                    <td className={styles.matrixFeatureCol}>Network Latency</td>
                    <td className={styles.matrixWinnerCell}>0.0ms (No upload or download)</td>
                    <td>Round-trip upload delay</td>
                    <td>0.0ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: FAQ */}
          {activeBottomTab === 'faq' && (
            <div className={styles.faqGrid}>
              <article className={styles.faqCard}>
                <div className={styles.faqQuestion}>
                  <HelpCircle size={14} color="var(--accent)" /> How does PixelPress compress images without a server?
                </div>
                <div className={styles.faqAnswer}>
                  PixelPress bundles real C and Rust image codecs (MozJPEG, OxiPNG, WebP, libaom) compiled directly into WebAssembly binaries. They execute locally inside browser Web Workers without ever making network requests.
                </div>
              </article>

              <article className={styles.faqCard}>
                <div className={styles.faqQuestion}>
                  <Lock size={14} color="var(--accent)" /> Are my photos and sensitive documents completely private?
                </div>
                <div className={styles.faqAnswer}>
                  Yes, 100%. Your images never leave your computer's RAM. There are zero cloud uploads, zero telemetry tracking your files, and no external APIs. When you close the tab, all memory is instantly freed.
                </div>
              </article>

              <article className={styles.faqCard}>
                <div className={styles.faqQuestion}>
                  <Zap size={14} color="var(--accent)" /> Why are files smaller than standard browser canvas exports?
                </div>
                <div className={styles.faqAnswer}>
                  Standard HTML5 canvas uses generic, fast compression algorithms. PixelPress uses MozJPEG with Trellis quantization (Viterbi path searching) and OxiPNG with brute-force row filtering to shave off up to 80% more bytes.
                </div>
              </article>

              <article className={styles.faqCard}>
                <div className={styles.faqQuestion}>
                  <Archive size={14} color="var(--accent)" /> Are there batch or file size caps?
                </div>
                <div className={styles.faqAnswer}>
                  None. Unlike commercial cloud compressors that limit you to 5MB or charge monthly subscriptions, PixelPress runs on your device's hardware, supporting large 50MB–100MB+ files and bulk ZIP downloads.
                </div>
              </article>
            </div>
          )}

          {/* TAB 3: Security & Tech Specs */}
          {activeBottomTab === 'about' && (
            <div className={styles.aboutCard}>
              <div className={styles.aboutGrid}>
                <div className={styles.aboutItem}>
                  <div className={styles.aboutItemTitle}>
                    <ShieldCheck size={14} color="var(--accent)" /> Zero-Trust Local Architecture
                  </div>
                  <div className={styles.aboutItemDesc}>
                    Designed specifically for high-security environments, legal documentation, healthcare imagery, and proprietary brand photography where third-party cloud uploads are prohibited.
                  </div>
                </div>

                <div className={styles.aboutItem}>
                  <div className={styles.aboutItemTitle}>
                    <Cpu size={14} color="var(--accent)" /> Multi-Threaded Web Worker Pool
                  </div>
                  <div className={styles.aboutItemDesc}>
                    Utilizes zero-copy ArrayBuffer transferables across background worker threads matching your device's CPU concurrency to keep the interface fluid at 60fps during heavy batch operations.
                  </div>
                </div>

                <div className={styles.aboutItem}>
                  <div className={styles.aboutItemTitle}>
                    <FileCode size={14} color="var(--accent)" /> Native Rust & C WASM Codecs
                  </div>
                  <div className={styles.aboutItemDesc}>
                    Powered by MozJPEG (Mozilla), OxiPNG (Rust), libwebp (Google), and libavif (AOMedia) with hardware SIMD acceleration where available.
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Clean Minimal Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <span>PixelPress</span>
            <span>·</span>
            <span>Fast, private image compression</span>
          </div>
          <div className={styles.footerBadges}>
            <span>100% In-Browser</span>
            <span>·</span>
            <span>Free & Open Source</span>
          </div>
        </footer>
      </main>
    </>
  );
}
