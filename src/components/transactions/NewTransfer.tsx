'use client';
import { useRef, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { api, inputClass, useData, type AccountOption } from '@/lib/client';
import { Button } from '@/components/ui';
import { ErrorNotice, Field } from '@/components/ui/Workspace';

export function NewTransfer({ onCreated }: { onCreated: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState('');
  const [key,setKey]=useState('');
  const [form,setForm]=useState({sourceAccountId:'',destinationAccountId:'',amount:'',transactionType:'NEFT',occurredAt:'',description:''});
  const accounts=useData<{data:AccountOption[]}>(open?'/api/accounts':null);
  const currency=accounts.data?.data.find(a=>a.id===form.sourceAccountId)?.currency??'INR';
  function change(field:string,value:string){setForm(f=>({...f,[field]:value}));setKey(crypto.randomUUID());}
  async function submit(event:FormEvent){
    event.preventDefault();setBusy(true);setError(null);
    try{
      await api('/api/transactions',{method:'POST',body:JSON.stringify({...form,currency,occurredAt:new Date(form.occurredAt).toISOString(),idempotencyKey:key})});
      dialog.current?.close();setOpen(false);setMessage('Transfer saved. Synchronize the graph to analyze it.');onCreated();
    }catch(e){setError(e instanceof Error?e.message:'Unable to save transfer.');}finally{setBusy(false);}
  }
  return <div><Button size="sm" onClick={()=>{setKey(crypto.randomUUID());setForm({sourceAccountId:'',destinationAccountId:'',amount:'',transactionType:'NEFT',occurredAt:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16),description:''});setError(null);setMessage('');setOpen(true);dialog.current?.showModal();}}><Plus className="h-4 w-4"/>New transfer</Button>
    {message&&<p role="status" className="mt-2 max-w-xs text-[11px] text-emerald-300">{message}</p>}
    <dialog ref={dialog} aria-labelledby="new-transfer-title" onClose={()=>setOpen(false)} className="m-auto w-[min(94vw,600px)] rounded-2xl border border-neutral-700 bg-neutral-950 p-6 text-neutral-100 shadow-2xl backdrop:bg-black/80">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="new-transfer-title" className="text-xl font-medium">Record a synthetic transfer</h2><p className="mt-2 text-xs leading-6 text-neutral-400">Creates a completed ledger record and queues its graph update. This simulator does not move real funds or track balances.</p></div><Button aria-label="Close transfer form" variant="ghost" size="sm" onClick={()=>dialog.current?.close()} disabled={busy}><X className="h-4 w-4"/></Button></div>
      <form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
        <Field label="From account"><select className={inputClass} value={form.sourceAccountId} onChange={e=>change('sourceAccountId',e.target.value)} required><option value="">Choose account</option>{accounts.data?.data.map(a=><option key={a.id} value={a.id} disabled={!['ACTIVE','UNDER_REVIEW'].includes(a.status)}>{a.account_number} · {a.currency}</option>)}</select></Field>
        <Field label="To account"><select className={inputClass} value={form.destinationAccountId} onChange={e=>change('destinationAccountId',e.target.value)} required><option value="">Choose account</option>{accounts.data?.data.map(a=><option key={a.id} value={a.id} disabled={a.id===form.sourceAccountId||a.currency!==currency||!['ACTIVE','UNDER_REVIEW'].includes(a.status)}>{a.account_number} · {a.currency}</option>)}</select></Field>
        <Field label={`Amount (${currency})`}><input type="number" className={inputClass} min="0.01" step="0.01" max="99999999999999.99" value={form.amount} onChange={e=>change('amount',e.target.value)} required placeholder="0.00"/></Field>
        <Field label="Transfer method"><select className={inputClass} value={form.transactionType} onChange={e=>change('transactionType',e.target.value)}>{['NEFT','RTGS','IMPS','UPI','WIRE_TRANSFER','INTERNAL_TRANSFER'].map(v=><option key={v}>{v}</option>)}</select></Field>
      </div><Field label="Occurred at (your local time)"><input type="datetime-local" className={inputClass} value={form.occurredAt} onChange={e=>change('occurredAt',e.target.value)} required/></Field><Field label="Description"><textarea className={inputClass} value={form.description} onChange={e=>change('description',e.target.value)} maxLength={1000} placeholder="Purpose of this synthetic transfer"/></Field><ErrorNotice message={error??accounts.error}/><Button type="submit" disabled={busy||accounts.loading} className="w-full">{busy?'Saving transfer…':'Save transfer'}</Button></form>
    </dialog>
  </div>;
}
