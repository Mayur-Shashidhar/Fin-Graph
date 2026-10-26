'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, RotateCw } from 'lucide-react';
import type { DetectionRule } from '@/types';
import { api, inputClass, readable, useData } from '@/lib/client';
import { Button, Card } from '@/components/ui';
import { ErrorNotice, Field, Loading, PageTitle } from '@/components/ui/Workspace';

type Rule = DetectionRule & { code: string | null; supported: boolean; effectiveThresholds: Record<string, number> | null };
export default function RulesPage() {
  const rules = useData<{ data: Rule[] }>('/api/detection/rules');
  const [notice,setNotice] = useState<string|null>(null);
  return <div className="space-y-6"><PageTitle title="Detection rules" description="Tune pattern detectors. Changes apply to the next run and are recorded in the audit trail."><Button variant="outline" onClick={rules.reload}><RotateCw className="h-4 w-4"/>Refresh</Button><Link href="/graph-analysis"><Button>Run detection<ArrowRight className="h-4 w-4"/></Button></Link></PageTitle>
    <p className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-xs leading-6 text-neutral-400">Amounts are INR thresholds. Paths are bounded to six hops. These academic indicators support investigation and do not establish that a crime occurred.</p>
    {notice&&<p role="status" className="rounded-lg border border-emerald-800/50 p-3 text-xs text-emerald-200">{notice}</p>}
    <ErrorNotice message={rules.error} retry={rules.reload}/>{rules.loading ? <Loading/> : <div className="grid items-start gap-5 xl:grid-cols-2">{rules.data?.data.map(rule => <RuleCard key={rule.id + '-' + rule.updated_at} rule={rule} reload={()=>{setNotice('Rule saved. The next detection run will use these settings.');rules.reload();}}/>)}</div>}
  </div>;
}
function RuleCard({ rule, reload }: { rule: Rule; reload: () => void }) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [thresholds, setThresholds] = useState<Record<string, string>>(Object.fromEntries(Object.entries(rule.effectiveThresholds ?? {}).map(([k,v]) => [k,String(v)])));
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await api('/api/detection/rules/' + rule.id, { method: 'PATCH', body: JSON.stringify({ enabled, thresholds: Object.fromEntries(Object.entries(thresholds).map(([k,v]) => [k, Number(v)])), expectedUpdatedAt: new Date(rule.updated_at).toISOString() }) }); reload(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to save rule.'); }
    finally { setBusy(false); }
  }
  return <Card className="p-5"><form onSubmit={save} className="space-y-5">
    <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] text-neutral-500">{rule.code ?? 'CUSTOM RULE'}</p><h3 className="mt-2 text-sm font-semibold text-neutral-100">{rule.name}</h3><p className="mt-2 text-xs leading-6 text-neutral-400">{rule.description}</p></div>
    <label className="flex shrink-0 items-center gap-2 text-xs text-neutral-400"><input type="checkbox" role="switch" aria-label={'Enable ' + rule.name} checked={enabled} disabled={!rule.supported || busy} onChange={e => setEnabled(e.target.checked)} className="h-4 w-4 accent-white"/>{enabled ? 'On' : 'Off'}</label></div>
    <div className="grid grid-cols-2 gap-4">{Object.entries(thresholds).map(([key,value]) => <Field key={key} label={readable(key)}><input type="number" className={inputClass} value={value} onChange={e => setThresholds(v => ({ ...v, [key]: e.target.value }))} step="any" min="0.01" required disabled={!rule.supported || busy}/></Field>)}</div>
    <ErrorNotice message={error}/><div className="flex items-center justify-between gap-3 border-t border-neutral-800 pt-4"><span className="text-xs text-neutral-500">{rule.supported ? 'Changes apply on the next run.' : 'This custom rule has no detector.'}</span><Button type="submit" size="sm" disabled={busy || !rule.supported}>{busy ? 'Saving…' : 'Save rule'}</Button></div>
  </form></Card>;
}
