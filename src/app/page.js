"use client";

import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { UploadCloud, Zap, Download, Lock, GitBranch, ImagePlus, ShieldCheck, FileType, ArrowDownCircle, AlertCircle } from 'lucide-react';
import styles from './page.module.css';
import { compressImage, formatBytes } from '../utils/compressor';

export default function Home() {
  const [images, setImages] = useState([]);
  const [format, setFormat] = useState('original');
  const [quality, setQuality] = useState(70);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = (files) => {
    const validFiles = Array.from(files).filter(f => f.type.match(/^image\/(jpeg|png|webp)$/));
    const newImages = validFiles.map(f => ({
      id: Math.random().toString(36).substring(2, 9),
      originalFile: f,
      originalSize: f.size,
      name: f.name,
      status: 'pending'
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
    const updatedImages = [...images];
    
    for (let i = 0; i < updatedImages.length; i++) {
      // Set status to compressing so the UI updates
      updatedImages[i] = { ...updatedImages[i], status: 'compressing' };
      setImages([...updatedImages]);

      // Always compress when the button is clicked, ignoring previous status
      const result = await compressImage(updatedImages[i].originalFile, { format, quality });
      
      // Preserve the original ID so React doesn't lose track of the element
      updatedImages[i] = { ...result, id: updatedImages[i].id };
      setImages([...updatedImages]);
    }
    setIsCompressing(false);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const completed = images.filter(img => img.status === 'done' && img.compressedBlob);
    
    completed.forEach(img => {
      let finalName = img.name;
      if (format !== 'original') {
        const ext = format === 'image/jpeg' ? '.jpg' : format === 'image/png' ? '.png' : '.webp';
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
    images.forEach(img => { if(img.compressedUrl) URL.revokeObjectURL(img.compressedUrl); });
    setImages([]);
  };

  const removeImage = (id) => {
    const imgToRemove = images.find(img => img.id === id);
    if (imgToRemove?.compressedUrl) {
      URL.revokeObjectURL(imgToRemove.compressedUrl);
    }
    setImages(images.filter(img => img.id !== id));
  };

  const totalOrig = images.reduce((acc, img) => acc + img.originalSize, 0);
  const totalOpt = images.reduce((acc, img) => acc + (img.compressedSize || img.originalSize), 0);
  const totalSaved = totalOrig - totalOpt;
  const savedPercent = totalOrig === 0 ? 0 : Math.round((totalSaved / totalOrig) * 100);
  const ringOffset = 125.6 - (125.6 * savedPercent) / 100;

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.navLogo}>
            <img src="/logo.png" alt="PixelPress Logo" className={styles.logoImage} />
            <span className={styles.logoText}>PixelPress</span>
          </div>
          <div className={styles.navRight}>
            <div className={styles.privacyBadge}>
              <Lock size={14} /> 100% Private
            </div>
            <a href="#" className={styles.githubLink}>
              <GitBranch size={16} /> GitHub
            </a>
          </div>
        </div>
      </nav>

      <header className={styles.hero}>
        <span className={styles.heroEyebrow}>Local Compression Engine</span>
        <h1 className={styles.heroTitle}>Free Image <span className="gradient-text">Compressor</span></h1>
        <p className={styles.heroSubtitle}>High-performance PNG, JPG & WebP optimization. Powered by native browser APIs, 100% private.</p>
      </header>

      <main className={styles.mainContainer}>
        <div className={`${styles.toolCard} delay-1 anim-scale-in`}>
          <div className={styles.toolHeader}>
            <div>
              <h2 className={styles.toolTitle}>Image Optimizer</h2>
              <p className={styles.toolSubtitle}>Drop images below to start compressing.</p>
            </div>
            <div className={styles.summaryPanel}>
              <div className={styles.summaryStats}>
                <div className={styles.metaRow}>Original: <span>{formatBytes(totalOrig)}</span></div>
                <div className={styles.metaRow}>Optimized: <span>{formatBytes(totalOpt)}</span></div>
                <div className={styles.metaRow}>Saved: <span className="gradient-text">{formatBytes(totalSaved)}</span></div>
              </div>
              <div className={styles.ringWrap}>
                <svg className={styles.ringSvg} width="48" height="48" viewBox="0 0 48 48">
                  <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#60A5FA" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  <circle className={styles.ringBg} cx="24" cy="24" r="20"></circle>
                  <circle className={styles.ringProgress} cx="24" cy="24" r="20" style={{ strokeDashoffset: ringOffset }}></circle>
                </svg>
                <span className={styles.ringText}>{savedPercent}%</span>
              </div>
            </div>
          </div>

          <div className={styles.actionBar}>
            <div className={styles.actionButtons}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={16} /> Upload Images
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                accept="image/jpeg, image/png, image/webp" 
                className="visually-hidden" 
                onChange={(e) => handleFiles(e.target.files)} 
              />
              <button className={`${styles.btn} ${styles.btnSecondary}`} disabled={images.length === 0 || isCompressing} onClick={handleCompressAll}>
                <Zap size={16} /> {images.length > 1 ? 'Compress All' : 'Compress'}
              </button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} disabled={!images.some(i => i.status === 'done')} onClick={handleDownloadAll}>
                <Download size={16} /> {images.length > 1 ? 'Download All (ZIP)' : 'Download ZIP'}
              </button>
              <button className={`${styles.btn} ${styles.btnGhost}`} disabled={images.length === 0} onClick={handleClear}>Clear</button>
            </div>

            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <label>Format</label>
                <select className={styles.selectInput} value={format} onChange={e => setFormat(e.target.value)}>
                  <option value="original">Keep Original</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
              
              <div className={styles.controlGroup} style={{ opacity: format === 'image/png' ? 0.4 : 1, pointerEvents: format === 'image/png' ? 'none' : 'auto' }}>
                <label>Quality</label>
                <input type="range" className={styles.rangeSlider} min="1" max="100" value={quality} onChange={e => setQuality(Number(e.target.value))} />
                <span className={styles.rangeValue}>{quality}</span>
              </div>
            </div>
            
            <div className={styles.helperText}>
              {format === 'image/jpeg' && <><span className={`${styles.helperBadge} ${styles.lossyBadge}`}>Lossy</span> Great for photos, but no transparency. Quality slider reduces file size.</>}
              {format === 'image/png' && <><span className={`${styles.helperBadge} ${styles.losslessBadge}`}>Lossless</span> Perfect quality and supports transparency, but large files. Quality slider is ignored.</>}
              {format === 'image/webp' && <><span className={`${styles.helperBadge} ${styles.lossyBadge}`}>Lossy</span> Modern format. Excellent compression and supports transparency!</>}
              {format === 'original' && <><span className={`${styles.helperBadge} ${styles.losslessBadge}`}>Auto</span> Keeps the original format. Note: highly optimized PNGs may not compress further.</>}
            </div>
          </div>

          {images.length === 0 ? (
            <div className={styles.dropZoneWrapper}>
              <div 
                className={`${styles.dropZone} ${isDragOver ? styles.dragOver : ''}`} 
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={styles.dropIconWrap}><ImagePlus size={32} /></div>
                <div className={styles.dropTitle}>Drag & drop images here</div>
                <div className={styles.dropSubtitle}>Supports PNG, JPEG, WebP • <span className={styles.dropBrowse}>Browse files</span></div>
              </div>
            </div>
          ) : (
            <div className={styles.resultsSection}>
              <div className={styles.resultsGrid}>
                {images.map(img => (
                  <div key={img.id} className={styles.imageCard}>
                    <button className={styles.removeBtn} onClick={() => removeImage(img.id)}>×</button>
                    <div className={styles.cardTop}>
                      <div className={`${styles.thumbWrap} ${img.status === 'compressing' ? 'loading' : ''}`}>
                        {img.compressedUrl ? (
                          <img src={img.compressedUrl} alt="thumbnail" />
                        ) : (
                          <img src={URL.createObjectURL(img.originalFile)} alt="thumbnail" />
                        )}
                      </div>
                      <div className={styles.cardInfo}>
                        <div className={styles.fileName} title={img.name}>{img.name}</div>
                        <div className={styles.fileMeta}>
                          <div className={styles.metaRow}>Original: <span className={styles.metaValue}>{formatBytes(img.originalSize)}</span></div>
                          {img.compressedSize && (
                            <div className={styles.metaRow}>Optimized: <span className={styles.metaValue}>{formatBytes(img.compressedSize)}</span></div>
                          )}
                        </div>
                      </div>
                    </div>
                    {img.status === 'done' && (
                      <div className={styles.cardBottom}>
                        <div className={`${styles.badge} ${img.reductionPercentage > 50 ? styles.badgeGreen : img.reductionPercentage > 20 ? styles.badgeYellow : styles.badgeBlue}`}>
                          <ArrowDownCircle size={12} /> {img.reductionPercentage.toFixed(1)}%
                        </div>
                        {img.reductionPercentage === 0 && (
                          <div className={styles.zeroReductionTip}>
                            <AlertCircle size={12} /> Try WebP
                          </div>
                        )}
                        <a href={img.compressedUrl} download={img.name} className={styles.dropBrowse}>Download</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <section className={`${styles.features} delay-3 anim-fade-up`}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}><Zap size={24} /></div>
          <div className={styles.featureInfo}>
            <div className={styles.featureTitle}>Lightning Fast</div>
            <div className={styles.featureDesc}>Powered by native browser APIs</div>
          </div>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}><ShieldCheck size={24} /></div>
          <div className={styles.featureInfo}>
            <div className={styles.featureTitle}>100% Private</div>
            <div className={styles.featureDesc}>Files never leave your device</div>
          </div>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}><FileType size={24} /></div>
          <div className={styles.featureInfo}>
            <div className={styles.featureTitle}>Format Conversion</div>
            <div className={styles.featureDesc}>Switch between PNG, JPG, WebP</div>
          </div>
        </div>
      </section>
    </>
  );
}
