'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') return <main className="min-h-screen">{children}</main>;
  return <><Sidebar/><div className="flex min-h-screen flex-1 flex-col lg:pl-72"><Header/><main className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main></div></>;
}
