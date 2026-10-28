# PixelPress

A privacy-first, client-side image compression engine powered by multi-threaded WebAssembly codecs (MozJPEG, OxiPNG, WebP, AVIF). Compress, convert, and batch-export images entirely in your browser with zero server uploads and zero quality loss.

[Live Demo](https://pixel-press-iota.vercel.app/)

## Features

- **100% Client-Side Processing**: Runs inside Web Workers via WebAssembly. Files never touch a remote server.
- **Production Codecs**: MozJPEG, OxiPNG, WebP, and AVIF with clamped heuristics to prevent CPU stalls on large files.
- **Interactive Before / After Comparison**: Draggable split-slider and side-by-side modes to inspect pixel fidelity before downloading.
- **Resolution Downscaling**: Optional max-dimension downscaling (4K, 2K, 1080p, 720p) with high-quality bicubic resampling.
- **Workflow Presets**: Single-click presets for Web & SEO, Social, Lossless Archiving, and Ultra Compact output.
- **Clean Alpha Compositing**: Automatic Porter-Duff alpha blending onto solid white when converting transparent images to JPEG.
- **Batch ZIP Export**: Process multiple files simultaneously and export them organized in a single archive.
- **Zero Negative Compression**: Automatically preserves the original file if compression produces a larger payload.

## Technology Stack

- **Framework**: Next.js (App Router, Webpack)
- **UI Architecture**: React with CSS Modules
- **WASM Codecs**: `@jsquash/jpeg`, `@jsquash/oxipng`, `@jsquash/webp`, `@jsquash/avif`
- **Concurrency**: Dedicated Web Worker pool with zero-copy Transferable ArrayBuffers
- **Typography**: Geist Pixel Square, Geist Sans, Geist Mono
- **Icons**: Lucide React
- **Packaging**: JSZip

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm, pnpm, or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/belkysupreme22/PixelPress.git
   cd PixelPress
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Privacy and Data Handling

PixelPress contains no backend processing services or remote storage endpoints. Every byte of image decoding, resampling, and encoding executes strictly in local browser memory.
