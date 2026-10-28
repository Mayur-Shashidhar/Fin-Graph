'use client';
import { Button } from '@/components/ui';
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <div role="alert" className="mx-auto my-20 max-w-lg rounded-xl border border-neutral-700 bg-neutral-950 p-8 text-center"><h2 className="text-xl font-medium">This view could not be loaded</h2><p className="my-4 text-sm leading-6 text-neutral-400">Try again. If the problem continues, check the application and database connections.</p><Button onClick={reset}>Try again</Button></div>;
}
