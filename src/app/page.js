"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  Aperture,
  Feather,
  EyeOff,
  Focus,
  Shrink,
  ImageDown,
  Images,
  Boxes,
  Vault,
  Compass,
  Scale,
  ScanLine,
  PackageCheck,
  Download, 
  Trash2, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  SlidersHorizontal,
  TerminalSquare,
  Copy,
  CheckCheck,
  Info
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
  const [activeBottomTab, setActiveBottomTab] = useState('faq'); // 'faq' | 'about'
  const fileInputRef = useRef(null);
  const logEndRef = useRef(null);

  // Compression Stats Activity Log state
  const [logs, setLogs] = useState([
    {
      id: 'init-0',
      timestamp: new Date().toLocaleTimeString(),
      tag: 'INIT',
      level: 'info',
      message: 'WASM worker pool ready with multi-threaded codecs (MozJPEG, OxiPNG, WebP, AVIF)'
    }
  ]);
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  // Activity logger dispatcher
  const addLog = useCallback((tag, message, level = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    setLogs(prev => [...prev.slice(-99), { id, timestamp, tag, message, level }]);
    console.log(`%c[PixelPress ${tag}]%c ${message}`, 'color: #4ade80; font-weight: bold;', 'color: inherit;');
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (isLogExpanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isLogExpanded]);

  // Copy logs to clipboard
  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    const text = logs.map(l => `[${l.timestamp}] [${l.tag}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    notify('Logs copied', 'Activity telemetry copied to clipboard', 'info', 2000);
  };

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
    const origSize = imgItem.originalSize || imgItem.originalFile?.size || 0;
    const codecName = targetFormat === 'original' 
      ? imgItem.originalFile.type.replace('image/', '').toUpperCase() 
      : targetFormat.replace('image/', '').toUpperCase();

    addLog('CODEC', `Optimizing ${imgItem.name} (${formatBytes(origSize)}) -> ${codecName} [Q:${targetQuality}%, Effort:${targetEffort}]`, 'codec');

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

      // Stats Log
      if (result.reductionPercentage > 0) {
        addLog('DONE', `${imgItem.name}: ${formatBytes(origSize)} -> ${formatBytes(result.compressedSize)} (${result.reductionPercentage.toFixed(1)}% smaller) in ${result.durationMs}ms [${result.dimensions}]`, 'success');
      } else {
        addLog('OPTIMAL', `${imgItem.name}: Already optimal (${formatBytes(origSize)}); retained original file`, 'warn');
      }

      // Notify completion
      const savedText = result.reductionPercentage > 0 
        ? `${result.reductionPercentage.toFixed(1)}% smaller` 
        : 'already optimal';
      notify('Optimization complete', `${imgItem.name} is ${savedText}`, 'success');
    } catch (err) {
      addLog('ERROR', `${imgItem.name}: Compression failed - ${err.message}`, 'error');
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
      addLog('WARN', 'Rejected unsupported file format (supported: JPEG, PNG, WebP, AVIF)', 'warn');
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

    addLog('STAGE', `Staged ${newItems.length} ${newItems.length === 1 ? 'image' : 'images'} for background WASM optimization`, 'info');
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

    addLog('CONFIG', `Recompressing ${images.length} files with Format: ${targetFmt}, Quality: ${targetQ}%, Effort: ${targetEff}`, 'codec');
    notify('Recomputing queue', `Applying new codec & quality parameters`, 'info');
    setImages(prev => prev.map(img => ({ ...img, status: 'compressing' })));

    await Promise.all(
      images.map(img => compressSingle(img, targetFmt, targetQ, targetEff))
    );

    setIsCompressing(false);
  };

  // Single download trigger
  const handleDownloadSingle = (img) => {
    addLog('EXPORT', `Exported ${img.name} (${formatBytes(img.compressedSize || img.originalSize)})`, 'info');
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

    addLog('ARCHIVE', `Bundled ${completed.length} images into pixelpress_optimized.zip (${formatBytes(content.size)})`, 'success');
    notify('Download complete', 'Saved pixelpress_optimized.zip to your downloads', 'download');
  };

  const handleClear = () => {
    images.forEach(img => {
      if (img.compressedUrl) URL.revokeObjectURL(img.compressedUrl);
    });
    setImages([]);
    addLog('CLEAR', 'Workspace cleared and memory released', 'info');
    notify('Queue cleared', 'Workspace reset and memory released', 'clear');
  };

  const removeImage = (id) => {
    const item = images.find(img => img.id === id);
    if (item?.compressedUrl) {
      URL.revokeObjectURL(item.compressedUrl);
    }
    setImages(images.filter(img => img.id !== id));
    if (item) {
      addLog('REMOVE', `Removed ${item.name} from queue`, 'info');
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

  const anyCompressing = images.some(i => i.status === 'compressing');
  const allDone = images.length > 0 && images.every(i => i.status === 'done');

  return (
    <>
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 44px Sticky Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Aperture className={styles.brandIcon} />
            <span className={styles.brandName}>PixelPress</span>
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
              <span className={styles.pulseDot} />
              Instant & Private
            </span>
          </div>

          <div className={styles.headerMeta}>
            <span className={styles.badge}>
              <EyeOff size={12} />
              100% Private · Runs in your browser
            </span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Centered Hero Section with Ambient Flickering Canvas */}
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
              <Feather size={12} color="var(--accent)" />
              Featherweight Files · 100% Private · No Limits
            </div>

            <h1 className={styles.heroTitle}>
              Smaller files. Zero compromise.
            </h1>
          </div>
        </div>

        {/* 2-Column Workspace: Left = Controllers, Right = Image Input & Gallery */}
        <div className={styles.workspaceGrid}>
          {/* Left Column: Controllers */}
          <aside className={styles.controlsPanel}>
            <div className={styles.controlsHeader}>
              <SlidersHorizontal size={14} color="var(--accent)" />
              <span>Compression Settings</span>
            </div>

            <div className={styles.controlsGroup}>
              <div className={styles.field}>
                <div className={styles.fieldHeader}>
                  <span className={styles.fieldLabelWrap}>
                    <span>Format:</span>
                    <Tooltip 
                      showIcon={true}
                      label="Image Format" 
                      content="Choose output format: WebP is best for websites, JPEG for photos, PNG for graphics with transparent backgrounds, and AVIF for smallest file size."
                      position="top"
                    />
                  </span>
                </div>
                <select 
                  className={styles.select}
                  value={format} 
                  onChange={e => {
                    const newFmt = e.target.value;
                    setFormat(newFmt);
                    if (images.length > 0) handleRecompressAll(newFmt, quality, effort);
                  }}
                >
                  <option value="original">Auto (Keep Original Format)</option>
                  <option value="image/webp">WebP (Best for Websites)</option>
                  <option value="image/jpeg">JPEG (Best for Photos)</option>
                  <option value="image/png">PNG (Best for Graphics & Logos)</option>
                  <option value="image/avif">AVIF (Smallest File Size)</option>
                </select>
              </div>

              {format !== 'image/png' && (
                <div className={styles.field}>
                  <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabelWrap}>
                      <span>Quality:</span>
                      <Tooltip 
                        showIcon={true}
                        label="Image Quality" 
                        content="Quality level (1–100%). 75% delivers small file sizes with visually perfect clarity."
                        position="top"
                      />
                    </span>
                    <span className={styles.fieldValue}>{quality}%</span>
                  </div>
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
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <div className={styles.fieldHeader}>
                  <span className={styles.fieldLabelWrap}>
                    <span>Effort:</span>
                    <Tooltip 
                      showIcon={true}
                      label="Compression Effort" 
                      content="Compression effort (1–6). Higher levels take slightly longer to shrink files even more."
                      position="top"
                    />
                  </span>
                  <span className={styles.fieldValue}>{effort}</span>
                </div>
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
                </div>
              </div>
            </div>

            <div className={styles.actionButtons}>
              <button 
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFullWidth}`}
                onClick={() => fileInputRef.current?.click()}
                title="Browse and select images from your device"
              >
                <Images size={14} /> Select Images
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
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnFullWidth}`}
                  disabled={anyCompressing}
                  onClick={() => handleRecompressAll()}
                  title="Re-run compression with current parameters"
                >
                  <RefreshCw size={14} className={anyCompressing ? styles.spinnerSmall : ''} />
                  {anyCompressing ? 'Compressing...' : 'Recompress'}
                </button>
              )}
              {images.length > 0 && (
                <button 
                  className={`${styles.btn} ${allDone ? styles.btnActionHighlight : styles.btnSecondary} ${styles.btnFullWidth}`}
                  disabled={!images.some(i => i.status === 'done')}
                  onClick={handleDownloadAll}
                  title="Bundle all optimized images into a single ZIP archive"
                >
                  <PackageCheck size={14} /> Download All (ZIP)
                </button>
              )}
              {images.length > 0 && (
                <button 
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnFullWidth}`}
                  disabled={images.length === 0}
                  onClick={handleClear}
                  title="Clear all queued images and free allocated browser memory"
                >
                  <Trash2 size={14} /> Clear Queue
                </button>
              )}
            </div>
          </aside>

          {/* Right Column: Image Input & Gallery */}
          <section className={styles.stageArea}>
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
                  <ImageDown className={styles.dropIcon} />
                  <div className={styles.dropTitle}>Drop images here to compress instantly</div>
                  <div className={styles.dropSubtitle}>Supports JPG, PNG, WebP & AVIF · Unlimited batch uploads · No file size caps</div>
                  <div className={styles.dropZoneBadges}>
                    <span className={styles.dropZoneBadgeItem}>
                      <Feather size={11} color="var(--accent)" /> Featherweight Output
                    </span>
                    <span className={styles.dropZoneBadgeItem}>
                      <EyeOff size={11} color="var(--accent)" /> 100% Private (No Uploads)
                    </span>
                    <span className={styles.dropZoneBadgeItem}>
                      <Boxes size={11} color="var(--accent)" /> Batch ZIP Download
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.listContainer}>
                {/* Compact drop banner to add more images */}
                <div 
                  className={`${styles.stageAddMore} ${isDragOver ? styles.dropZoneDrag : ''}`}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  title="Click or drop more images to add to the queue"
                >
                  <ImageDown size={14} color="var(--accent)" />
                  <span>Drop more images here, or click to add files</span>
                </div>

                <div className={styles.listHeader}>
                  <span>Compressed Images ({images.length} {images.length === 1 ? 'file' : 'files'})</span>
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
                            Compressing image...
                          </span>
                        ) : img.durationMs ? (
                          <span>Compressed in {img.durationMs}ms</span>
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
          </section>
        </div>

        {/* Live Compression Stats & Activity Logs */}
        <section className={styles.logSection}>
          <div className={styles.logHeader}>
            <div className={styles.logHeaderLeft}>
              <div className={styles.logTitle}>
                <TerminalSquare size={13} color="var(--accent)" />
                <span>Compression Stats & Logs</span>
              </div>
              <span className={styles.logCountBadge}>{logs.length} events</span>
              {totalSaved > 0 && (
                <span className={styles.logStatsPill}>
                  <Check size={11} /> {formatBytes(totalSaved)} saved ({savedPercent}%)
                </span>
              )}
            </div>

            <div className={styles.logHeaderRight}>
              <button 
                className={styles.logActionBtn}
                onClick={handleCopyLogs}
                title="Copy activity logs to clipboard"
              >
                {copied ? <CheckCheck size={12} color="var(--accent)" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button 
                className={styles.logActionBtn}
                onClick={() => setLogs([])}
                title="Clear all logs"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
              <button 
                className={styles.logActionBtn}
                onClick={() => setIsLogExpanded(!isLogExpanded)}
                title={isLogExpanded ? 'Minimize logs' : 'Expand logs'}
              >
                <span>{isLogExpanded ? 'Minimize' : 'Expand'}</span>
              </button>
            </div>
          </div>

          {isLogExpanded && (
            <div className={styles.logTerminal}>
              {logs.length === 0 ? (
                <div className={styles.logEmpty}>
                  No events recorded yet. Drag and drop images to see live compression telemetry.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className={styles.logLine}>
                    <span className={styles.logTime}>{log.timestamp}</span>
                    <span className={`${styles.logTag} ${styles[`logTag_${log.tag}`] || styles[`logTag_${log.level}`]}`}>
                      [{log.tag}]
                    </span>
                    <span className={styles.logMsg}>{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          )}
        </section>

        {/* Feature Highlights Strip */}
        <section className={styles.engineStrip}>
          <div className={styles.engineCard}>
            <div className={styles.engineCardTitle}>
              <Boxes size={14} /> Batch Processing
            </div>
            <div className={styles.engineCardDesc}>
              Drop dozens of photos at once. Compress entire photo galleries or folders in seconds without slowing down.
            </div>
          </div>

          <div className={styles.engineCard}>
            <div className={styles.engineCardTitle}>
              <Vault size={14} /> 100% Private & Safe
            </div>
            <div className={styles.engineCardDesc}>
              Your photos never leave your device. Perfect for personal memories, confidential work files, and client assets.
            </div>
          </div>

          <div className={styles.engineCard}>
            <div className={styles.engineCardTitle}>
              <Scale size={14} /> Free Forever
            </div>
            <div className={styles.engineCardDesc}>
              No subscriptions, no hidden watermarks, and no file size limits. High-speed compression open to everyone.
            </div>
          </div>
        </section>

        {/* Knowledge Base Section: Tabbed Switcher (FAQ / Security & Specs) */}
        <section className={styles.knowledgeSection}>
          <div className={styles.knowledgeHeader}>
            <div className={styles.knowledgeTitleGroup}>
              <h2 className={styles.knowledgeTitle}>
                {activeBottomTab === 'faq' ? 'Frequently Asked Questions' : 'Privacy & Security'}
              </h2>
              <p className={styles.knowledgeSubtitle}>
                {activeBottomTab === 'faq' 
                  ? 'Everything you need to know about image compression, quality, and file formats.' 
                  : 'How PixelPress guarantees total confidentiality by processing images entirely on your device.'}
              </p>
            </div>

            <div className={styles.knowledgeTabs} role="tablist">
              <button 
                className={`${styles.tabBtn} ${activeBottomTab === 'faq' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveBottomTab('faq')}
                role="tab"
                aria-selected={activeBottomTab === 'faq'}
              >
                <Compass size={13} /> FAQ
              </button>
              <button 
                className={`${styles.tabBtn} ${activeBottomTab === 'about' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveBottomTab('about')}
                role="tab"
                aria-selected={activeBottomTab === 'about'}
              >
                <Vault size={13} /> Privacy & Security
              </button>
            </div>
          </div>

          {/* TAB 1: FAQ */}
          {activeBottomTab === 'faq' && (
            <div className={styles.faqGrid}>
              <article className={styles.faqCard}>
                <div className={styles.faqQuestion}>
                  <Aperture size={14} color="var(--accent)" /> How does PixelPress compress images without uploading them?
                </div>
                <div className={styles.faqAnswer}>
                  PixelPress runs advanced compression software directly inside your web browser. Instead of sending your photos to an internet server, your computer does all the work locally. That makes it faster, unlimited, and completely safe.
                </div>
              </article>

              <article className={styles.faqCard}>
                <div className={styles.faqQuestion}>
                  <EyeOff size={14} color="var(--accent)" /> Are my photos and personal documents completely private?
                </div>
                <div className={styles.faqAnswer}>
                  Yes, 100%. None of your files ever leave your computer. There are no cloud uploads, no tracking, and no copies saved anywhere. When you close the tab, all memory is instantly cleared.
                </div>
              </article>

              <article className={styles.faqCard}>
                <div className={styles.faqQuestion}>
                  <Focus size={14} color="var(--accent)" /> Will my pictures lose quality or look blurry?
                </div>
                <div className={styles.faqAnswer}>
                  No. PixelPress is calibrated to remove invisible data (like hidden metadata and subtle color redundancies) while preserving visual sharpness, fine details, and true colors.
                </div>
              </article>

              <article className={styles.faqCard}>
                <div className={styles.faqQuestion}>
                  <Scale size={14} color="var(--accent)" /> Are there file size or upload limits?
                </div>
                <div className={styles.faqAnswer}>
                  None at all. You can compress as many large 50MB+ photos as you need, anytime, without running into paywalls or daily upload quotas.
                </div>
              </article>
            </div>
          )}

          {/* TAB 2: Privacy & Security */}
          {activeBottomTab === 'about' && (
            <div className={styles.aboutCard}>
              <div className={styles.aboutGrid}>
                <div className={styles.aboutItem}>
                  <div className={styles.aboutItemTitle}>
                    <Vault size={14} color="var(--accent)" /> Zero Cloud Uploads
                  </div>
                  <div className={styles.aboutItemDesc}>
                    Your files never leave your device. Ideal for personal family albums, confidential business documents, client photography, and proprietary designs.
                  </div>
                </div>

                <div className={styles.aboutItem}>
                  <div className={styles.aboutItemTitle}>
                    <ScanLine size={14} color="var(--accent)" /> Smooth Multitasking
                  </div>
                  <div className={styles.aboutItemDesc}>
                    Processing runs quietly in the background so your browser never freezes or stutters, even when handling large batches of high-resolution images.
                  </div>
                </div>

                <div className={styles.aboutItem}>
                  <div className={styles.aboutItemTitle}>
                    <Images size={14} color="var(--accent)" /> Universal Compatibility
                  </div>
                  <div className={styles.aboutItemDesc}>
                    Exports standard JPG, PNG, WebP, and AVIF images ready to share by email, post to social media, or publish to websites.
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
