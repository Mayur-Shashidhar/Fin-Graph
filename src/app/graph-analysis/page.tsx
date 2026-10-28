'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Network, Play, RefreshCw, ArrowRight } from 'lucide-react';
import { api, inputClass, useData, type AccountOption } from '@/lib/client';
import { formatDateTime, formatINR } from '@/lib/formatters';
import type { GraphAccount, GraphFinding, GraphSnapshot, GraphTransfer } from '@/types/graph';
import type { AlertDetail, SystemStatus } from '@/types/workspace';
import { Button, Card } from '@/components/ui';
import { Empty, ErrorNotice, Field, Loading, PageTitle, StatusPill } from '@/components/ui/Workspace';
import { GraphCanvas } from '@/components/graph/GraphCanvas';

export default function GraphPage() { return <Suspense fallback={<Loading/>}><GraphWorkspace/></Suspense>; }
function GraphWorkspace() {
  const params = useSearchParams();
  const [accountId,setAccountId]=useState(params.get('accountId')??''), [depth,setDepth]=useState('2');
  const [start,setStart]=useState(''),[end,setEnd]=useState(''),[query,setQuery]=useState(() => params.get('accountId') ? new URLSearchParams({accountId:params.get('accountId')!,depth:'2',limit:'500'}).toString() : 'limit=200');
  const graph = useData<GraphSnapshot & { meta:{truncated:boolean;totalEdges:number} }>('/api/graph?'+query);
  const system = useData<SystemStatus>('/api/system');
  const accounts = useData<{data:AccountOption[]}>('/api/accounts');
  const alert = useData<AlertDetail>(params.get('alertId') ? '/api/alerts/'+params.get('alertId') : null);
  const [run,setRun]=useState<{runId:string;findingCount:number;created:number;duplicates:number;durationMs:number;findings:GraphFinding[]}|null>(null);
  const [finding,setFinding]=useState<GraphFinding|null>(null),[context,setContext]=useState(false);
  const [selected,setSelected]=useState<GraphAccount|GraphTransfer|null>(null);
  const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const highlighted = finding?.evidence.transactionIds ?? alert.data?.transactions.map(t=>t.id) ?? [];
  const allGraph = graph.data;
  const evidenceEdges = allGraph?.edges.filter(e=>highlighted.includes(e.id))??[];
  const evidenceNodes = new Set(evidenceEdges.flatMap(e=>[e.source,e.target]));
  const visible = allGraph ? !context && evidenceEdges.length ? {nodes:allGraph.nodes.filter(n=>evidenceNodes.has(n.id)),edges:evidenceEdges} : allGraph : null;
  function filter(event:FormEvent) {
    event.preventDefault();
    const p=new URLSearchParams({limit:'500',depth});
    if(accountId)p.set('accountId',accountId);
    if(start)p.set('startDate',new Date(start+'T00:00:00Z').toISOString());
    if(end)p.set('endDate',new Date(end+'T23:59:59.999Z').toISOString());
    setQuery(p.toString());setSelected(null);setContext(true);
  }
  async function synchronize() {
    setBusy('Synchronizing');setError(null);setNotice(null);
    try {
      let pending=1, rounds=0, failed=0;
      while(pending&&rounds++<40) {
        const batch=await api<{pending:number;failed:number;dead:number;batchProcessed:number}>('/api/graph/sync',{method:'POST',body:'{"batchSize":500}'});
        pending=batch.pending;failed=batch.failed+batch.dead;
        if(failed || !batch.batchProcessed)break;
      }
      setNotice(failed?'Some updates need a retry. Check the worker or database connection.':pending?'Updates remain queued. Keep the synchronization worker running.':'Graph synchronized with the transaction ledger.');
      graph.reload();system.reload();
    }catch(e){setError(e instanceof Error?e.message:'Synchronization failed.');}finally{setBusy(null);}
  }
  async function detect() {
    setBusy('Running detection');setError(null);setNotice(null);
    try{
      const result=await api<NonNullable<typeof run>>('/api/detection/run',{method:'POST',body:'{"persist":true}'});
      setRun(result);setFinding(result.findings[0]??null);setContext(false);setSelected(null);system.reload();graph.reload();
      setNotice(result.findingCount+' patterns found. '+result.created+' new alerts; '+result.duplicates+' already recorded.');
    }catch(e){setError(e instanceof Error?e.message:'Detection failed.');}finally{setBusy(null);}
  }
  return <div className="space-y-6">
    <PageTitle title="Graph analysis" description="Follow directed money flows, synchronize the ledger, and inspect explainable pattern detections.">
      {!!system.data && (system.data.sync.failed+system.data.sync.dead)>0 && <Button variant="outline" disabled={!!busy} onClick={async()=>{try{await api('/api/graph/sync/retry',{method:'POST'});await synchronize();}catch(e){setError(e instanceof Error?e.message:'Unable to retry updates.');}}}>Retry failed updates</Button>}
      <Button variant="outline" onClick={synchronize} disabled={!!busy}><RefreshCw className={'h-4 w-4 '+(busy==='Synchronizing'?'animate-spin':'')}/>Sync data</Button>
      <Button onClick={detect} disabled={!!busy}><Play className="h-4 w-4"/>{busy??'Run detection'}</Button>
    </PageTitle>
    <div className="grid gap-3 sm:grid-cols-4">{[
      ['Graph engine',system.loading?'Checking connection':system.data?.demo?'Local demo projection':system.data?.graph.connected?'Neo4j connected':'Neo4j unavailable'],
      ['Ledger',system.data?.database.connected?'Connected':'Checking connection'],
      ['Queued updates',system.data?String(system.data.sync.pending+system.data.sync.failed+system.data.sync.dead):'—'],
      ['Last synchronized',system.data?.sync.lastSyncedAt?formatDateTime(system.data.sync.lastSyncedAt):'Not synchronized'],
    ].map(([label,value])=><Card key={label} className="p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p><p className="mt-2 text-sm text-neutral-200">{value}</p></Card>)}</div>
    {system.data?.demo&&<p className="text-xs text-amber-200/80">Local demo mode uses a saved graph projection and the same detection engine. Neo4j is disabled in this mode.</p>}
    <ErrorNotice message={error??graph.error??system.error??accounts.error??alert.error} retry={()=>{graph.reload();system.reload();accounts.reload();}}/>
    {notice&&<p role="status" className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-200">{notice}</p>}
    {alert.data&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-800/60 bg-amber-950/15 p-4"><div><p className="text-xs text-amber-300">Alert evidence</p><p className="mt-1 text-sm">{alert.data.alert.title}</p></div><Link href={'/alerts/'+alert.data.alert.id} className="text-xs underline">Back to review</Link></div>}
    <Card className="p-4"><form onSubmit={filter} className="grid items-end gap-3 md:grid-cols-[2fr_.6fr_1fr_1fr_auto]">
      <Field label="Account"><select className={inputClass} value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">All accounts</option>{accounts.data?.data.map(a=><option key={a.id} value={a.id}>{a.account_number} · {a.customer_name}</option>)}</select></Field>
      <Field label="Hops"><select className={inputClass} value={depth} onChange={e=>setDepth(e.target.value)}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></Field>
      <Field label="From date (UTC)"><input type="date" className={inputClass} value={start} onChange={e=>setStart(e.target.value)}/></Field>
      <Field label="To date (UTC, inclusive)"><input type="date" className={inputClass} value={end} onChange={e=>setEnd(e.target.value)}/></Field><Button variant="outline">Apply filters</Button>
    </form></Card>
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_290px]"><div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3 text-xs text-neutral-500"><span>{visible?.nodes.length??0} accounts · {visible?.edges.length??0} transfers</span><label className="flex items-center gap-2"><input type="checkbox" checked={context} onChange={e=>setContext(e.target.checked)} className="accent-white"/>Show surrounding context</label></div>
      {graph.loading?<Loading label="Loading transaction graph…"/>:visible?.nodes.length?<GraphCanvas key={query+(finding?.fingerprint??'')+context} graph={visible} highlighted={highlighted} selected={selected?.id??null} onAccount={setSelected} onTransfer={setSelected}/>:<Empty title="No graph data in this view">Sync data first, or choose a wider account/date range.</Empty>}
      {allGraph?.meta.truncated&&(context||!evidenceEdges.length)&&<p className="text-xs text-amber-200">Showing a bounded view of {allGraph.meta.totalEdges} matching transfers. Choose an account or date range to narrow it.</p>}
      {highlighted.length>0&&!evidenceEdges.length&&!graph.loading&&<p className="text-xs text-amber-200">The selected evidence is outside this filtered view. Clear the account/date filters to locate it.</p>}
    </div><Card className="p-5"><div className="mb-4 flex items-center gap-2 text-sm"><Network className="h-4 w-4 text-neutral-500"/>Selection details</div>{!selected?<p className="text-xs leading-6 text-neutral-500">Select an account or transfer in the graph to inspect its ledger details. Orange links highlight the selected detection evidence.</p>:'accountNumber'in selected?<div className="space-y-4 text-xs"><p className="font-mono text-neutral-100">{selected.accountNumber}</p><p className="leading-6 text-neutral-400">{selected.customerName}</p><StatusPill value={selected.status}/><p className="text-neutral-500">Currency: {selected.currency}</p><Button variant="outline" size="sm" onClick={()=>{setAccountId(selected.id);setQuery(new URLSearchParams({accountId:selected.id,depth,limit:'500'}).toString());setContext(true);}}>Explore neighborhood</Button><p className="break-all font-mono text-[10px] text-neutral-600">{selected.id}</p></div>:<div className="space-y-4 text-xs"><p className="text-lg font-mono">{selected.currency==='INR'?formatINR(selected.amount):selected.currency+' '+selected.amount}</p><StatusPill value={selected.status}/><p className="text-neutral-400">{formatDateTime(selected.occurredAt)}</p><p className="break-all text-neutral-500">From {accounts.data?.data.find(a=>a.id===selected.source)?.account_number??selected.source}</p><p className="break-all text-neutral-500">To {accounts.data?.data.find(a=>a.id===selected.target)?.account_number??selected.target}</p><p className="break-all font-mono text-[10px] text-neutral-600">{selected.id}</p></div>}</Card></div>
    {run&&<section className="space-y-4"><div className="flex items-center justify-between"><h3 className="text-base font-medium">Detected patterns ({run.findingCount})</h3><Link href="/alerts" className="flex items-center gap-2 text-xs text-neutral-400">Review alert queue<ArrowRight className="h-3 w-3"/></Link></div>
      {!run.findings.length?<Empty title="No patterns match the enabled rules">You can review the rule thresholds or inspect more transactions.</Empty>:<div className="grid gap-3 md:grid-cols-2">{run.findings.map(f=><button key={f.fingerprint} onClick={()=>{setFinding(f);setContext(false);setSelected(null);setAccountId('');setStart('');setEnd('');setQuery('limit=500');}} className={'rounded-xl border p-4 text-left transition-colors '+(finding?.fingerprint===f.fingerprint?'border-amber-500/70 bg-amber-950/20':'border-neutral-800 bg-neutral-950 hover:border-neutral-600')}><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{f.title}</span><StatusPill value={f.severity}/></div><p className="mt-3 text-xs text-neutral-500">{f.evidence.accountIds.length} accounts · {f.evidence.transactionIds.length} transfers · Risk {f.riskScore}/100</p><p className="mt-2 text-[11px] text-neutral-400">Select to highlight the evidence</p></button>)}</div>}
    </section>}
    <Card className="p-5"><h3 className="mb-3 text-sm font-medium">Recent detection runs</h3>{system.data?.runs.length?<div className="divide-y divide-neutral-800">{system.data.runs.map(r=><div key={r.id} className="flex flex-wrap justify-between gap-3 py-3 text-xs text-neutral-400"><span>{formatDateTime(r.started_at)}</span><span>{r.summary.findingCount??'—'} findings · {r.summary.created??0} new alerts</span><StatusPill value={r.status}/></div>)}</div>:<p className="text-xs text-neutral-500">No detection runs yet. Synchronize data, then run detection.</p>}</Card>
  </div>;
}
