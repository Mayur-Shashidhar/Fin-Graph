'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Network } from 'lucide-react';
import { useData, readable } from '@/lib/client';
import { formatDateTime, formatINR } from '@/lib/formatters';
import type { TransactionRecord, Alert } from '@/types';
import { Button, Card } from '@/components/ui';
import { Empty, ErrorNotice, Loading, PageTitle, StatusPill } from '@/components/ui/Workspace';

export default function TransactionDetail(){
  const {id}=useParams<{id:string}>();
  const result=useData<{transaction:TransactionRecord;alerts:Alert[]}>(`/api/transactions/${id}`);
  if(result.loading)return <Loading/>;
  if(!result.data)return <ErrorNotice message={result.error} retry={result.reload}/>;
  const {transaction:t,alerts}=result.data;
  return <div className="space-y-6"><Link href="/transactions" className="flex items-center gap-2 text-xs text-neutral-400"><ArrowLeft className="h-3 w-3"/>Transaction ledger</Link><PageTitle title="Transaction details" description="Inspect the ledger record, counterparties and associated detection evidence."><Link href={`/graph-analysis?accountId=${t.source_account_id}`}><Button variant="outline"><Network className="h-4 w-4"/>Explore network</Button></Link></PageTitle><Card className="p-6"><div className="flex items-center justify-between gap-3"><h3 className="text-2xl font-mono">{t.currency==='INR'?formatINR(t.amount):`${t.currency} ${t.amount}`}</h3><StatusPill value={t.status}/></div><p className="mt-2 text-xs text-neutral-500">{readable(t.transaction_type)} · {formatDateTime(t.occurred_at)}</p><div className="my-6 grid gap-5 rounded-xl border border-neutral-800 bg-black p-5 md:grid-cols-[1fr_auto_1fr]"><div><p className="mb-2 text-xs text-neutral-500">From</p><p className="text-sm font-mono">{t.source_account_number}</p><p className="mt-2 text-sm text-neutral-400">{t.source_customer_name}</p></div><ArrowRight className="my-auto h-5 w-5 text-neutral-600"/><div><p className="mb-2 text-xs text-neutral-500">To</p><p className="text-sm font-mono">{t.destination_account_number}</p><p className="mt-2 text-sm text-neutral-400">{t.destination_customer_name}</p></div></div><p className="text-sm leading-7 text-neutral-300">{t.description||'No description provided.'}</p><p className="mt-5 break-all font-mono text-xs text-neutral-600">Transaction ID: {t.id}</p></Card><h3 className="text-base font-medium">Linked alerts ({alerts.length})</h3>{!alerts.length?<Empty title="No alerts currently reference this transfer">Synchronize the graph and run detection to evaluate new activity.</Empty>:<div className="space-y-3">{alerts.map(a=><Link key={a.id} href={`/alerts/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-5 hover:border-neutral-600"><div><p className="text-sm">{a.title}</p><p className="mt-1 text-xs text-neutral-500">Risk {a.risk_score}/100</p></div><StatusPill value={a.status}/></Link>)}</div>}</div>;
}
