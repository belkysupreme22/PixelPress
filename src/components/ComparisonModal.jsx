"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  SplitSquareVertical, 
  Download,
  ArrowLeftRight 
} from 'lucide-react';
import styles from './ComparisonModal.module.css';
import { formatBytes, getOutputFilename } from '../utils/compressor';

export default function ComparisonModal({ image, isOpen, onClose, targetFormat }) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
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
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
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
  const outMime = image.mimeType || image.compressedBlob?.type || targetFormat;
  const formatLabel = outMime ? outMime.replace('image/', '').toUpperCase() : 'OPTIMIZED';
  const downloadFilename = getOutputFilename(image.name, outMime);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.titleWrap}>
              <span className={styles.modalBadge}>
                <SplitSquareVertical size={12} color="var(--accent)" />
                BEFORE / AFTER
              </span>
              <span className={styles.imageName} title={image.name}>{image.name}</span>
              {outMime && (
                <span className={styles.modalFormatBadge}>
                  {formatLabel}
                </span>
              )}
              <span className={styles.metricsBadge}>
                {formatBytes(originalSize)} → {formatBytes(compressedSize)} 
                <span className={styles.reductionText}>
                  {reduction > 0 ? ` (${reduction.toFixed(1)}% smaller)` : ' (Optimal)'}
                </span>
              </span>
            </div>
          </div>

          <div className={styles.headerControls}>
            {image.compressedUrl && (
              <a 
                href={image.compressedUrl} 
                download={downloadFilename}
                className={styles.downloadBtn}
                title={`Download ${downloadFilename}`}
              >
                <Download size={13} />
                <span>Download ({formatLabel})</span>
              </a>
            )}

            <button className={styles.closeBtn} onClick={onClose} title="Close comparison (Esc)">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Viewport: Interactive Split-Slider Comparator */}
        <div className={styles.viewport}>
          <div 
            ref={containerRef}
            className={`${styles.splitStage} ${isDragging ? styles.dragging : ''}`}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {/* Layer 1: Compressed / Optimized (Base background) */}
            <div className={styles.imageLayer}>
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
              <div className={styles.imageLayer}>
                <img 
                  src={originalSrc} 
                  alt="Original" 
                  className={styles.previewImage}
                  draggable={false}
                />
              </div>
            </div>

            {/* Interactive Divider Line with Pill Handle */}
            <div 
              className={styles.dividerLine}
              style={{ left: `${sliderPos}%` }}
            >
              <div className={styles.handleKnobPill}>
                <span className={styles.handleLabelLeft}>ORIGINAL</span>
                <ArrowLeftRight size={11} color="var(--accent)" />
                <span className={styles.handleLabelRight}>OPTIMIZED</span>
              </div>
            </div>

            {/* Floating Top Corner Indicators */}
            <div className={styles.topIndicatorLeft}>
              <span>BEFORE · ORIGINAL</span>
            </div>
            <div className={styles.topIndicatorRight}>
              <span>AFTER · {formatLabel}</span>
            </div>

            {/* Floating Bottom Metadata Pills */}
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
        </div>

        {/* Modal Footer */}
        <div className={styles.footer}>
          <div className={styles.footerHint}>
            <span>Tip: Drag the vertical slider or use Left / Right arrow keys to inspect pixel fidelity · Press Esc to exit</span>
          </div>
          <div className={styles.footerRatio}>
            <span>Split: {Math.round(sliderPos)}% Original / {Math.round(100 - sliderPos)}% Optimized</span>
          </div>
        </div>
      </div>
    </div>
  );
}
