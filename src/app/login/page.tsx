'use client';
import { useState, type FormEvent } from 'react';
import { Network, ArrowRight, LockKeyhole } from 'lucide-react';
import { api, inputClass } from '@/lib/client';
import { Button } from '@/components/ui';
import { ErrorNotice, Field } from '@/components/ui/Workspace';
import { safeReturnPath } from '@/lib/navigation';

export default function LoginPage() {
  const [name, setName] = useState('Investigator');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      await api('/api/auth/session', { method: 'POST', body: JSON.stringify({ name, key }) });
      const next = new URLSearchParams(window.location.search).get('next') ?? '/';
      window.location.assign(safeReturnPath(next, window.location.origin));
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to sign in.'); setBusy(false); }
  }
  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,#171717,transparent_70%)] p-6"><div className="w-full max-w-md"><div className="mb-10 flex items-center gap-3"><div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3"><Network className="h-6 w-6"/></div><div><h1 className="text-xl font-semibold tracking-tight">FinGraph</h1><p className="text-xs text-neutral-500">Financial network intelligence</p></div></div><div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-7 shadow-2xl"><LockKeyhole className="mb-5 h-5 w-5 text-neutral-400"/><h2 className="text-2xl font-medium tracking-tight">Investigator sign in</h2><p className="mb-6 mt-2 text-sm leading-6 text-neutral-400">Explore transaction networks, review alerts, and trace suspicious money flows.</p><form onSubmit={signIn} className="space-y-5"><Field label="Your name"><input autoComplete="name" className={inputClass} value={name} onChange={e => setName(e.target.value)} required maxLength={80}/></Field><Field label="Workspace access key"><input type="password" autoComplete="current-password" className={inputClass} value={key} onChange={e => setKey(e.target.value)} required maxLength={512} placeholder="Enter the key from your setup"/></Field><ErrorNotice message={error}/><Button className="w-full" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Open workspace'}<ArrowRight className="h-4 w-4"/></Button></form></div><p className="mt-5 text-center text-xs leading-6 text-neutral-500">For the local demo, use the access key printed by <code>npm run demo</code>.<br/>All supplied financial records are synthetic.</p></div></div>;
}
