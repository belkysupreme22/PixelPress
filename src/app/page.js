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
  Layers, 
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
  const fileInputRef = useRef(null);

  const handleFiles = (files) => {
    const validFiles = Array.from(files).filter(f => 
      f.type.match(/^image\/(jpeg|png|webp|avif)$/)
    );
    const newImages = validFiles.map(f => ({
      id: Math.random().toString(36).substring(2, 9),
      originalFile: f,
      originalSize: f.size,
      name: f.name,
      status: 'pending',
    }));
    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleCompressAll = async () => {
    setIsCompressing(true);
    const currentList = [...images];

    for (let i = 0; i < currentList.length; i++) {
      currentList[i] = { ...currentList[i], status: 'compressing' };
      setImages([...currentList]);

      const result = await compressImage(currentList[i].originalFile, {
        format,
        quality,
        effort,
      });

      currentList[i] = { ...result, id: currentList[i].id };
      setImages([...currentList]);
    }
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
    link.download = 'pixelpress_wasm_optimized.zip';
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

  const totalOrig = images.reduce((acc, img) => acc + img.originalSize, 0);
  const totalOpt = images.reduce((acc, img) => acc + (img.compressedSize || img.originalSize), 0);
  const totalSaved = Math.max(0, totalOrig - totalOpt);
  const savedPercent = totalOrig === 0 ? 0 : Math.round((totalSaved / totalOrig) * 100);

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
              100% Local Sandbox
            </span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Hero Section */}
        <div className={styles.hero}>
          <div className={styles.heroTag}>
            <Zap size={12} color="var(--accent)" />
            MozJPEG · OxiPNG · LibWebP · LibAOM
          </div>
          <h1 className={styles.heroTitle}>High-craft image compression.</h1>
          <p className={styles.heroDesc}>
            Lossless and lossy WASM compilation running directly inside background Web Workers. 
            No cloud APIs, no file uploads, pure browser execution.
          </p>
        </div>

        {/* Controls Panel */}
        <div className={styles.controlsPanel}>
          <div className={styles.controlsRow}>
            <div className={styles.controlsGroup}>
              <div className={styles.field}>
                <span>Target:</span>
                <select 
                  className={styles.select}
                  value={format} 
                  onChange={e => setFormat(e.target.value)}
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
                    className={styles.rangeInput}
                  />
                  <span className={styles.rangeVal}>{effort}</span>
                </div>
              </div>
            </div>

            <div className={styles.controlsGroup}>
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
              <button 
                className={`${styles.btn} ${styles.btnSecondary}`}
                disabled={images.length === 0 || isCompressing}
                onClick={handleCompressAll}
              >
                <Layers size={14} /> {isCompressing ? 'Compressing...' : 'Compress all'}
              </button>
              <button 
                className={`${styles.btn} ${styles.btnSecondary}`}
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
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneDrag : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={styles.dropIcon} />
            <div className={styles.dropTitle}>Drop images to optimize</div>
            <div className={styles.dropSubtitle}>JPEG, PNG, WebP, AVIF up to 100MB+ per file</div>
          </div>
        ) : (
          <div className={styles.listContainer}>
            <div className={styles.listHeader}>
              <span>Queue ({images.length} files)</span>
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
                    <span>{img.dimensions || 'Detecting...'}</span>
                    <span>·</span>
                    <span>{img.status === 'compressing' ? 'Running WASM...' : img.durationMs ? `${img.durationMs}ms` : 'Ready'}</span>
                    {img.status === 'error' && (
                      <span style={{ color: 'var(--error)' }}>Failed: {img.error}</span>
                    )}
                  </div>
                </div>

                <div className={styles.itemTelemetry}>
                  <div className={styles.telemetryOrig}>
                    {formatBytes(img.originalSize)}
                  </div>
                  {img.compressedSize && (
                    <div className={styles.telemetryOpt}>
                      {formatBytes(img.compressedSize)}
                    </div>
                  )}
                  {img.status === 'done' && (
                    <span className={styles.reductionTag}>
                      -{img.reductionPercentage.toFixed(1)}%
                    </span>
                  )}
                </div>

                <div className={styles.itemActions}>
                  {img.status === 'done' && (
                    <a 
                      href={img.compressedUrl} 
                      download={img.name}
                      className={styles.actionIconBtn}
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
              <Cpu size={14} color="var(--accent)" /> MozJPEG Engine
            </div>
            <div className={styles.engineCardDesc}>
              Trellis quantization and per-image Huffman entropy optimization compiled to WebAssembly.
            </div>
          </div>

          <div className={styles.engineCard}>
            <div className={styles.engineCardTitle}>
              <Zap size={14} color="var(--accent)" /> OxiPNG Optimizer
            </div>
            <div className={styles.engineCardDesc}>
              Multi-threaded Rust DEFLATE optimizer testing dynamic row filter combinations.
            </div>
          </div>

          <div className={styles.engineCard}>
            <div className={styles.engineCardTitle}>
              <FileCode size={14} color="var(--accent)" /> Web Workers
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
