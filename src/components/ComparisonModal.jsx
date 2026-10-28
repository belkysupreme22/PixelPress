"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Columns2, 
  SplitSquareVertical, 
  Download, 
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import styles from './ComparisonModal.module.css';
import { formatBytes } from '../utils/compressor';

export default function ComparisonModal({ image, isOpen, onClose, targetFormat }) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'side-by-side'
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit, 2 = 2x zoom
  const containerRef = useRef(null);

  // Close on Escape, slider control on Left/Right arrows
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setSliderPos(prev => Math.max(0, prev - (e.shiftKey ? 10 : 2)));
      } else if (e.key === 'ArrowRight') {
        setSliderPos(prev => Math.min(100, prev + (e.shiftKey ? 10 : 2)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle drag positioning
  const updatePosition = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    updatePosition(e.clientX);
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    if (e.touches[0]) updatePosition(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    };

    const handleTouchMove = (e) => {
      if (!isDragging || !e.touches[0]) return;
      updatePosition(e.touches[0].clientX);
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, updatePosition]);

  if (!isOpen || !image) return null;

  const originalSrc = image.originalUrl || (image.originalFile ? URL.createObjectURL(image.originalFile) : null);
  const compressedSrc = image.compressedUrl || originalSrc;
  const originalSize = image.originalSize || image.originalFile?.size || 0;
  const compressedSize = image.compressedSize || originalSize;
  const reduction = image.reductionPercentage || 0;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.titleWrap}>
              <span className={styles.imageName} title={image.name}>{image.name}</span>
              <span className={styles.metricsBadge}>
                {formatBytes(originalSize)} → {formatBytes(compressedSize)} 
                <span className={styles.reductionText}>
                  {reduction > 0 ? ` (${reduction.toFixed(1)}% smaller)` : ' (Optimal)'}
                </span>
              </span>
            </div>
          </div>

          <div className={styles.headerControls}>
            <div className={styles.viewToggleGroup}>
              <button 
                className={`${styles.toggleBtn} ${viewMode === 'split' ? styles.toggleBtnActive : ''}`}
                onClick={() => setViewMode('split')}
                title="Split slider view"
              >
                <SplitSquareVertical size={13} />
                <span>Split</span>
              </button>
              <button 
                className={`${styles.toggleBtn} ${viewMode === 'side-by-side' ? styles.toggleBtnActive : ''}`}
                onClick={() => setViewMode('side-by-side')}
                title="Side by side comparison"
              >
                <Columns2 size={13} />
                <span>Side by Side</span>
              </button>
            </div>

            <button 
              className={styles.iconBtn}
              onClick={() => setZoomLevel(prev => prev === 1 ? 1.75 : 1)}
              title={zoomLevel === 1 ? 'Zoom in (1.75x)' : 'Reset zoom'}
            >
              {zoomLevel === 1 ? <ZoomIn size={14} /> : <ZoomOut size={14} />}
            </button>

            {image.compressedUrl && (
              <a 
                href={image.compressedUrl} 
                download={image.name}
                className={styles.downloadBtn}
                title="Download this optimized image"
              >
                <Download size={13} />
                <span>Download</span>
              </a>
            )}

            <button className={styles.closeBtn} onClick={onClose} title="Close comparison (Esc)">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Viewport / Canvas Area */}
        <div className={styles.viewport}>
          {viewMode === 'split' ? (
            <div 
              ref={containerRef}
              className={`${styles.splitStage} ${isDragging ? styles.dragging : ''}`}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              {/* Layer 1: Compressed / Optimized (Base background) */}
              <div 
                className={styles.imageLayer}
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img 
                  src={compressedSrc} 
                  alt="Optimized" 
                  className={styles.previewImage}
                  draggable={false}
                />
              </div>

              {/* Layer 2: Original (Clipped on the left) */}
              <div 
                className={styles.clippedLayer}
                style={{ 
                  clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
                }}
              >
                <div 
                  className={styles.imageLayer}
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img 
                    src={originalSrc} 
                    alt="Original" 
                    className={styles.previewImage}
                    draggable={false}
                  />
                </div>
              </div>

              {/* Interactive Divider Line with Central Handle */}
              <div 
                className={styles.dividerLine}
                style={{ left: `${sliderPos}%` }}
              >
                <div className={styles.handleKnob}>
                  <ArrowLeftRight size={12} color="var(--accent)" />
                </div>
              </div>

              {/* Floating comparison metadata pills */}
              <div className={`${styles.labelPill} ${styles.labelPillLeft}`}>
                <span className={styles.labelTag}>ORIGINAL</span>
                <span>{formatBytes(originalSize)}</span>
                {image.origDimensions && <span className={styles.labelDim}>· {image.origDimensions}</span>}
              </div>

              <div className={`${styles.labelPill} ${styles.labelPillRight}`}>
                <span className={styles.labelTagOpt}>OPTIMIZED</span>
                <span>{formatBytes(compressedSize)}</span>
                {image.dimensions && <span className={styles.labelDim}>· {image.dimensions}</span>}
              </div>
            </div>
          ) : (
            /* Side by Side Mode */
            <div className={styles.sideBySideGrid}>
              <div className={styles.sideCard}>
                <div className={styles.sideCardHeader}>
                  <span className={styles.labelTag}>ORIGINAL</span>
                  <span className={styles.sideCardMeta}>{formatBytes(originalSize)} {image.origDimensions ? `· ${image.origDimensions}` : ''}</span>
                </div>
                <div className={styles.sideCardImageWrap} style={{ transform: `scale(${zoomLevel})` }}>
                  <img src={originalSrc} alt="Original" className={styles.previewImage} />
                </div>
              </div>

              <div className={styles.sideCard}>
                <div className={styles.sideCardHeader}>
                  <span className={styles.labelTagOpt}>OPTIMIZED</span>
                  <span className={styles.sideCardMeta}>{formatBytes(compressedSize)} {image.dimensions ? `· ${image.dimensions}` : ''} ({reduction.toFixed(1)}% smaller)</span>
                </div>
                <div className={styles.sideCardImageWrap} style={{ transform: `scale(${zoomLevel})` }}>
                  <img src={compressedSrc} alt="Optimized" className={styles.previewImage} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Hints */}
        <div className={styles.footer}>
          <div className={styles.footerHint}>
            <span>Tip: Drag slider or use Left / Right arrows to inspect pixel fidelity. Press Esc to exit.</span>
          </div>
          <div className={styles.footerRatio}>
            <span>Split: {Math.round(sliderPos)}% Original / {Math.round(100 - sliderPos)}% Optimized</span>
          </div>
        </div>
      </div>
    </div>
  );
}
