import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://fmh-oral-2026.onrender.com'),
  title: 'ORAL / 26',
  description: 'FMH orthopaedics oral board daily review tracker.',
  openGraph: {
    title: 'ORAL / 26',
    description: 'FMH ORTHOPAEDICS · DAILY REVIEW',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ORAL / 26',
    description: 'FMH ORTHOPAEDICS · DAILY REVIEW',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
