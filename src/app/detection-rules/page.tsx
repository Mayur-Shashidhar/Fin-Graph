import React from 'react';
import Link from 'next/link';
import { Sliders, Clock, ArrowLeft } from 'lucide-react';
import { Card, CardContent, Badge, Button } from '@/components/ui';

export default function DetectionRulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] text-neutral-400 border-neutral-700">
              Rules Engine
            </Badge>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sliders className="h-5 w-5 text-white" />
            Detection Rules
          </h2>
          <p className="text-xs text-neutral-400">
            AML parameter threshold tuning, pattern definitions, and rule toggle console.
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
            Detection Rules Management
          </h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto font-mono">
            7 detection rules with JSONB thresholds are provisioned in PostgreSQL. Dynamic rule authoring and threshold editing console will be implemented in subsequent sprints.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
