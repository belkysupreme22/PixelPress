"use client";

import { useEffect, useRef } from "react";

export default function FlickeringGrid({
  squareSize = 3,
  gridGap = 4,
  flickerChance = 0.25,
  color = "#ffffff",
  maxOpacity = 0.28,
  className = "",
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let gridParams = { cols: 0, rows: 0, squares: [] };

    // Setup High DPI Canvas
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const step = squareSize + gridGap;
      const cols = Math.floor(rect.width / step);
      const rows = Math.floor(rect.height / step);

      const squares = new Float32Array(cols * rows);
      for (let i = 0; i < squares.length; i++) {
        squares[i] = Math.random() * maxOpacity;
      }

      gridParams = { cols, rows, squares, width: rect.width, height: rect.height };
    };

    updateSize();

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      // Draw single still frame
      drawFrame(ctx, gridParams, squareSize, gridGap, color, false);
      return;
    }

    let lastTime = 0;
    const targetInterval = 60; // Smooth ~16-20 updates per second for measured ambient flicker

    const render = (time) => {
      animationFrameId = requestAnimationFrame(render);

      if (time - lastTime < targetInterval) return;
      lastTime = time;

      // Update flickering values
      const { squares } = gridParams;
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance) {
          squares[i] = Math.random() * maxOpacity;
        }
      }

      drawFrame(ctx, gridParams, squareSize, gridGap, color, true);
    };

    animationFrameId = requestAnimationFrame(render);

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [squareSize, gridGap, flickerChance, color, maxOpacity]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        WebkitMaskImage:
          "radial-gradient(180% 90% at 50% 10%, #000 35%, transparent 95%)",
        maskImage:
          "radial-gradient(180% 90% at 50% 10%, #000 35%, transparent 95%)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}

function drawFrame(ctx, gridParams, squareSize, gridGap, color, clear = true) {
  const { cols, rows, squares, width, height } = gridParams;
  if (!cols || !rows) return;

  if (clear) {
    ctx.clearRect(0, 0, width, height);
  }

  const step = squareSize + gridGap;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const opacity = squares[idx];
      if (opacity <= 0.01) continue;

      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fillRect(c * step, r * step, squareSize, squareSize);
    }
  }
}
