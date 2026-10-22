import React from 'react';
import Link from 'next/link';
import { Network, Clock, ArrowLeft } from 'lucide-react';
import { Card, CardContent, Badge, Button } from '@/components/ui';

export default function GraphAnalysisPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] text-neutral-400 border-neutral-700">
              Sprint 3 Scope
            </Badge>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Network className="h-5 w-5 text-white" />
            Graph Analysis
          </h2>
          <p className="text-xs text-neutral-400">
            Interactive money laundering ring visualization and multi-hop cycle traversal.
          </p>
        </div>

        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Button>
        </Link>
      </div>

      <Card className="border-dashed border-neutral-800 bg-neutral-950">
        <CardContent className="py-16 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400">
            <Clock className="h-6 w-6 text-neutral-300" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-200">
            Graph Engine Explorer Placeholder
          </h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto font-mono">
            Graph visualization and Neo4j graph algorithms will be implemented in Sprint 3. The underlying transaction edges and account nodes are structured in the PostgreSQL schema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
