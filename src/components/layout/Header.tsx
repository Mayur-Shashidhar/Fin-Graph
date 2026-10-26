'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Database, ExternalLink, LogOut } from 'lucide-react';
import { api, useData } from '@/lib/client';
import { Badge, Button } from '@/components/ui';

export function Header() {
  const router = useRouter();
  const session = useData<{ name: string; demo: boolean }>('/api/auth/session');
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-800 bg-black/90 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-neutral-300" />
          <h1 className="text-sm font-semibold text-white tracking-tight">
            Surveillance Console
          </h1>
        </div>
        <span className="hidden sm:inline-block text-neutral-700">|</span>
        <div className="hidden sm:flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] text-neutral-400">
            {session.data?.demo ? 'Local synthetic demo' : 'PostgreSQL + Neo4j'}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-neutral-400 sm:block">{session.data?.name}</span>
        <Button variant="ghost" size="sm" aria-label="Sign out" onClick={async () => { await api('/api/auth/session', { method: 'DELETE' }); router.replace('/login'); router.refresh(); }}><LogOut className="h-4 w-4"/></Button>
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-xs text-neutral-400">
          <Database className="h-3.5 w-3.5 text-neutral-400" />
          <span className="font-mono text-[11px] text-neutral-300">Reporting: INR (₹)</span>
        </div>

        <Link href="/api/health" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 border-neutral-700 hover:border-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
            <span className="hidden sm:inline">Health</span>
            <ExternalLink className="h-3 w-3 text-neutral-400" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
