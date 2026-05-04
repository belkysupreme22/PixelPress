import './globals.css';

export const metadata = {
  title: 'PixelPress — Free Local Image Compressor',
  description: 'Optimize PNG, JPEG & WebP images locally in your browser. No uploads, 100% private, fast batch processing.',
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
