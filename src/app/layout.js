import './globals.css';

export const metadata = {
  title: 'PixelPress — Local WASM Image Engine',
  description: 'True MozJPEG, OxiPNG, WebP & AVIF compression running entirely in your browser via WebAssembly. Private, high performance.',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
