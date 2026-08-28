import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';

import './globals.css';

const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ScanFood — scanne, compare, choisis mieux',
  description:
    'Scanne un produit, lis son score de santé, compare deux références en combat ou organise un tournoi. Données OpenFoodFacts.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'ScanFood',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#FAF8F4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
