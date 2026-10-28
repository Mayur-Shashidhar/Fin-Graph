'use client';
import { useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Network } from 'lucide-react';
import { api, inputClass, useData, readable } from '@/lib/client';
import { formatDateTime, formatINR } from '@/lib/formatters';
import type { AlertDetail } from '@/types/workspace';
import { Button, Card } from '@/components/ui';
import { Empty, ErrorNotice, Field, Loading, PageTitle, StatusPill } from '@/components/ui/Workspace';

export default function AlertPage() {
  const { id } = useParams<{ id: string }>();
  const result = useData<AlertDetail>(`/api/alerts/${id}`);
  if (result.loading) return <Loading/>;
  if (!result.data) return <ErrorNotice message={result.error} retry={result.reload}/>;
  return <AlertWorkspace key={String(result.data.alert.updated_at)} detail={result.data} reload={result.reload}/>;
}
function AlertWorkspace({ detail, reload }: { detail: AlertDetail; reload: () => void }) {
  const { alert, notes, history, transactions } = detail;
  const [status, setStatus] = useState(alert.status), [note, setNote] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const options = alert.status.startsWith('CLOSED') ? [alert.status, 'INVESTIGATING'] : [...new Set([alert.status, 'INVESTIGATING', 'ESCALATED', 'CLOSED_RESOLVED', 'CLOSED_FALSE_POSITIVE'])];
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await api(`/api/alerts/${alert.id}`, { method: 'PATCH', body: JSON.stringify({ status, note, expectedUpdatedAt: new Date(alert.updated_at).toISOString() }) }); reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save review.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <Link href="/alerts" className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white"><ArrowLeft className="h-3 w-3"/>Alert queue</Link>
    <PageTitle title={alert.title} description="Review the underlying transfers and preserve the reasoning behind your decision."><Link href={`/graph-analysis?alertId=${alert.id}`}><Button variant="outline"><Network className="h-4 w-4"/>Explore evidence</Button></Link></PageTitle>
    <div className="flex flex-wrap items-center gap-3"><StatusPill value={alert.severity}/><StatusPill value={alert.status}/><span className="text-sm font-mono text-neutral-400">Risk {alert.risk_score}/100</span><span className="text-xs text-neutral-500">Detected {formatDateTime(alert.created_at)}</span></div>
    <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]"><div className="space-y-6">
      <Card className="p-5"><p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Detection rationale</p><p className="mt-3 text-sm leading-7 text-neutral-300">{alert.description}</p><p className="mt-4 text-xs text-neutral-500">A pattern match is an investigation lead. Review context before taking action.</p></Card>
      <Card className="overflow-hidden"><h3 className="border-b border-neutral-800 p-5 text-sm font-medium">Linked transactions ({transactions.length})</h3>{!transactions.length ? <Empty title="No linked transaction remains in the ledger"/> : <div className="divide-y divide-neutral-800">{transactions.map(t => <div key={t.id} className="p-5"><div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-mono">{t.currency === 'INR' ? formatINR(t.amount) : `${t.currency} ${t.amount}`}</span><StatusPill value={t.status}/></div><p className="mt-3 text-xs text-neutral-300">{t.source_account_number} → {t.destination_account_number}</p><p className="mt-1 text-xs text-neutral-500">{t.source_customer_name} → {t.destination_customer_name}</p><p className="mt-2 text-xs text-neutral-500">{formatDateTime(t.occurred_at)}</p><p className="mt-2 break-all font-mono text-[10px] text-neutral-600">{t.id}</p></div>)}</div>}</Card>
      <Card className="p-5"><h3 className="mb-4 text-sm font-medium">Evidence</h3><dl className="space-y-4">{Object.entries(alert.evidence).filter(([k]) => !['thresholds','metrics'].includes(k)).map(([k,v]) => <div key={k}><dt className="text-xs text-neutral-500">{readable(k.replace(/([A-Z])/g,' $1'))}</dt><dd className="mt-1 break-words text-xs leading-6 text-neutral-300">{Array.isArray(v) ? v.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' → ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>)}</dl><details className="mt-5 text-xs text-neutral-500"><summary className="cursor-pointer">Complete evidence record</summary><pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-black p-3 text-[11px] text-neutral-400">{JSON.stringify(alert.evidence,null,2)}</pre></details></Card>
    </div><div className="space-y-6">
      <Card className="p-5"><h3 className="mb-5 text-sm font-medium">Investigation review</h3><form onSubmit={save} className="space-y-4"><Field label="Review status"><select className={inputClass} value={status} onChange={e => setStatus(e.target.value as typeof status)}>{options.map(v => <option key={v} value={v}>{readable(v)}</option>)}</select></Field><Field label="Investigator note"><textarea className={`${inputClass} min-h-28 resize-y`} value={note} onChange={e => setNote(e.target.value)} maxLength={4000} placeholder="Record what you reviewed and why…"/></Field><ErrorNotice message={error}/><Button disabled={busy || (!note.trim() && status === alert.status)} type="submit" className="w-full">{busy ? 'Saving…' : 'Save review'}</Button></form></Card>
      <Card className="p-5"><h3 className="mb-4 text-sm font-medium">Case notes ({notes.length})</h3>{!notes.length ? <p className="text-xs text-neutral-500">No investigator notes yet.</p> : <div className="space-y-5">{notes.map(n => <div key={n.id} className="border-l border-neutral-700 pl-4"><p className="whitespace-pre-wrap text-sm leading-6 text-neutral-300">{n.body}</p><p className="mt-2 text-[11px] text-neutral-500">{n.author} · {formatDateTime(n.created_at)}</p></div>)}</div>}</Card>
      <Card className="p-5"><h3 className="mb-4 text-sm font-medium">Review history</h3>{!history.length ? <p className="text-xs text-neutral-500">No review actions recorded.</p> : history.map(h => <div key={h.id} className="border-b border-neutral-800 py-3 text-xs last:border-0"><p className="text-neutral-300">{h.actor} · {readable(h.action)}</p><p className="mt-1 text-neutral-500">{String(h.details.from ?? '')} → {String(h.details.to ?? '')}</p><p className="mt-1 text-neutral-600">{formatDateTime(h.created_at)}</p></div>)}</Card>
    </div></div>
  </div>;
}
