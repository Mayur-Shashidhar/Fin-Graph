'use client';
import { useCallback, useEffect, useState } from 'react';

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers }, cache: 'no-store' });
  if (response.status === 401 && !url.startsWith('/api/auth/')) {
    // Expiry must discard the document's in-memory investigation data as well.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'The request could not be completed.');
  return data as T;
}
export function useData<T>(url: string | null) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key: '', data: null, error: null });
  const key = `${url}:${revision}`;
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    api<T>(url, { signal: controller.signal }).then(data => setState({ key, data, error: null })).catch(error => {
      if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : 'Unable to load data.' });
    });
    return () => controller.abort();
  }, [url, key]);
  const reload = useCallback(() => setRevision(n => n + 1), []);
  return { data: state.data, error: state.key === key ? state.error : null, loading: !!url && state.key !== key, reload };
}
export const readable = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, s => s.toUpperCase());
export const inputClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 disabled:opacity-50';
export type AccountOption = { id: string; account_number: string; customer_name: string; currency: string; status: string };
