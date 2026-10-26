import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FinGraph | AML & Money Laundering Ring Detection',
  description: 'Graph-based financial surveillance and money laundering ring detection platform',
  keywords: ['AML', 'FinGraph', 'Anti-Money Laundering', 'Graph Detection', 'Financial Surveillance'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-black text-neutral-100 font-sans antialiased flex flex-col`}
      >
        <Suspense fallback={<main className="p-12 text-sm text-neutral-500">Loading workspace…</main>}><AppShell>{children}</AppShell></Suspense>
      </body>
    </html>
  );
}
