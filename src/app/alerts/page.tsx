'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, RotateCw, Search } from 'lucide-react';
import type { Alert } from '@/types';
import { useData, inputClass, readable } from '@/lib/client';
import { formatDateTime } from '@/lib/formatters';
import { Button, Card } from '@/components/ui';
import { Empty, ErrorNotice, Field, Loading, PageTitle, StatusPill } from '@/components/ui/Workspace';

export default function AlertsPage() {
  const [page, setPage] = useState(1), [status, setStatus] = useState('ALL'), [severity, setSeverity] = useState('ALL');
  const [search, setSearch] = useState(''), [term, setTerm] = useState('');
  const result = useData<{ data: Alert[]; pagination: { totalCount: number; totalPages: number } }>('/api/alerts?' + new URLSearchParams({ page: String(page), status, severity, search: term }));
  function find(event: FormEvent) { event.preventDefault(); setTerm(search); setPage(1); }
  return <div className="space-y-6">
    <PageTitle title="Alerts" description="Prioritize suspicious patterns, inspect their evidence, and record your investigation.">
      <Button variant="outline" onClick={result.reload}><RotateCw className="h-4 w-4"/>Refresh</Button>
      <Link href="/graph-analysis"><Button>Run detection<ArrowRight className="h-4 w-4"/></Button></Link>
    </PageTitle>
    <Card className="grid gap-4 p-4 md:grid-cols-[1fr_200px_160px]">
      <form className="flex items-end gap-2" onSubmit={find}><div className="flex-1"><Field label="Find an alert"><input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pattern or title" maxLength={200}/></Field></div><Button variant="outline" aria-label="Search alerts"><Search className="h-4 w-4"/></Button></form>
      <Field label="Review status"><select className={inputClass} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{['ALL','NEW','INVESTIGATING','ESCALATED','CLOSED_RESOLVED','CLOSED_FALSE_POSITIVE'].map(v => <option key={v} value={v}>{readable(v)}</option>)}</select></Field>
      <Field label="Severity"><select className={inputClass} value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}>{['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(v => <option key={v}>{v}</option>)}</select></Field>
    </Card>
    <ErrorNotice message={result.error} retry={result.reload}/>
    {result.loading ? <Loading/> : result.data && <>
      <div className="flex justify-between text-xs text-neutral-400"><span>{result.data.pagination.totalCount} matching alerts</span><span>Highest risk first</span></div>
      {!result.data.data.length ? <Empty title="No alerts match these filters">Adjust the filters or run detection on the graph.</Empty> :
      <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-800 bg-neutral-900/50 text-xs text-neutral-400"><tr>{['Pattern / evidence','Severity','Risk','Status','Detected',''].map(h => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-neutral-800">{result.data.data.map(alert => <tr key={alert.id} className="hover:bg-neutral-900/50">
          <td className="max-w-sm px-5 py-4"><Link className="font-medium text-neutral-100 hover:underline" href={'/alerts/' + alert.id}>{alert.title}</Link><p className="mt-1 truncate text-xs text-neutral-500">{readable(alert.alert_type)}</p></td>
          <td className="px-5 py-4"><StatusPill value={alert.severity}/></td><td className="px-5 py-4 font-mono">{alert.risk_score}<span className="text-neutral-600">/100</span></td>
          <td className="px-5 py-4"><StatusPill value={alert.status}/></td><td className="whitespace-nowrap px-5 py-4 text-xs text-neutral-500">{formatDateTime(alert.created_at)}</td>
          <td className="px-5 py-4"><Link href={'/alerts/' + alert.id} aria-label={'Review ' + alert.title}><ArrowRight className="h-4 w-4"/></Link></td>
        </tr>)}</tbody></table></div></Card>}
      <div className="flex items-center justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-xs text-neutral-400">Page {page} of {Math.max(1, result.data.pagination.totalPages)}</span><Button variant="outline" disabled={page >= result.data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button></div>
    </>}
  </div>;
}
