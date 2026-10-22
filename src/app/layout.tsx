import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar, Header } from '@/components/layout';

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
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
