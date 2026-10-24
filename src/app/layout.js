import './globals.css';

export const metadata = {
  title: 'PixelPress — Smaller files. Zero compromise.',
  description: 'Compress photos and graphics up to 80% without losing detail. Fast, free, and completely private—running directly in your browser with no upload limits.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
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
