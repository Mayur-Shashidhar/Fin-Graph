'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Network,
  ShieldAlert,
  Sliders,
  Menu,
  X,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Graph Analysis', href: '/graph-analysis', icon: Network, tag: 'Sprint 3' },
  { name: 'Alerts', href: '/alerts', icon: ShieldAlert, tag: 'Roadmap' },
  { name: 'Detection Rules', href: '/detection-rules', icon: Sliders, tag: 'Roadmap' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Header Bar */}
      <div className="lg:hidden flex items-center justify-between border-b border-neutral-800 bg-black px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-700 text-white">
            <Network className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-semibold tracking-tight text-white text-sm">FinGraph</span>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-400">AML Surveillance</span>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-neutral-800 bg-neutral-950 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Branding */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-5">
          <Link href="/" className="flex items-center gap-3 group" onClick={() => setMobileOpen(false)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-700 text-white">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold tracking-tight text-white">FinGraph</span>
                <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[9px] font-mono font-medium text-neutral-300 border border-neutral-800">
                  v0.2
                </span>
              </div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">
                AML Surveillance
              </p>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-neutral-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Surveillance
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-neutral-900 text-white border border-neutral-700'
                      : 'text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isActive ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-300'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.tag && !isActive && (
                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                        {item.tag}
                      </span>
                    )}
                    {isActive && <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="pt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            System Layer
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-neutral-400" />
                Data Layer
              </span>
              <span className="font-mono text-[11px] text-neutral-200">PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-neutral-400" />
                Graph Engine
              </span>
              <span className="font-mono text-[11px] text-neutral-400">Planned</span>
            </div>
          </div>
        </div>

        {/* Footer / Health Status */}
        <div className="border-t border-neutral-800 p-4 bg-neutral-950">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300">Database Layer</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-neutral-700 text-neutral-400">
                Server-Only
              </Badge>
            </div>
            <Link
              href="/api/health"
              target="_blank"
              className="flex items-center justify-between text-xs text-neutral-400 hover:text-white transition-colors group"
            >
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                GET /api/health
              </span>
              <span className="text-[10px] text-neutral-400 underline underline-offset-2">Status</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
