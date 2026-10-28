'use client';
import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Button } from './Button';

export function PageTitle({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">FinGraph / Investigation workspace</p><h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2><p className="mt-2 max-w-xl text-sm text-neutral-400">{description}</p></div><div className="flex flex-wrap gap-2">{children}</div></div>;
}
export function ErrorNotice({ message, retry }: { message: string | null; retry?: () => void }) {
  return message ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-200"><AlertCircle className="h-4 w-4 shrink-0"/><span className="flex-1">{message}</span>{retry && <Button size="sm" variant="outline" onClick={retry}>Try again</Button>}</div> : null;
}
export function Loading({ label = 'Loading workspace…' }: { label?: string }) { return <div role="status" className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-400"><LoaderCircle className="h-5 w-5 animate-spin"/>{label}</div>; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="rounded-xl border border-dashed border-neutral-700 p-12 text-center"><h3 className="text-sm font-medium text-neutral-100">{title}</h3><div className="mt-2 text-sm text-neutral-400">{children}</div></div>; }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-2 text-xs font-medium text-neutral-400"><span>{label}</span>{children}</label>; }
export function StatusPill({ value }: { value: string }) {
  const color = value === 'CRITICAL' || value === 'ESCALATED' ? 'border-red-500/40 bg-red-500/10 text-red-300' : value === 'HIGH' || value === 'NEW' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : value.startsWith('CLOSED') || value === 'COMPLETED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-neutral-700 bg-neutral-900 text-neutral-300';
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${color}`}>{value.replaceAll('_', ' ')}</span>;
}
