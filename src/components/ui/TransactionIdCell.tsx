'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface TransactionIdCellProps {
  id: string;
  className?: string;
}

/**
 * Accessible, compact Transaction ID display cell.
 * Truncates long UUIDs for table readability while providing:
 * 1. Accessible title and aria-labels exposing the complete UUID.
 * 2. One-click copy-to-clipboard with fallback support.
 * 3. Brief visual success feedback ("Copied!" state).
 * 4. Strict black-and-white monochrome styling.
 */
export function TransactionIdCell({ id, className = '' }: TransactionIdCellProps) {
  const [copied, setCopied] = useState(false);

  const shortId = id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(id);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = id;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Gracefully handle clipboard write rejection without throwing
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 font-mono text-xs ${className}`}>
      <span
        className="cursor-help underline decoration-neutral-700 underline-offset-2 hover:text-white transition-colors text-neutral-300"
        title={`Full Transaction UUID: ${id}`}
        aria-label={`Full Transaction ID: ${id}`}
      >
        {shortId}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center p-1 rounded border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-400"
        title={copied ? 'Copied full ID!' : 'Copy full UUID to clipboard'}
        aria-label={copied ? `Copied full transaction ID ${id}` : `Copy transaction ID ${id}`}
      >
        {copied ? (
          <span className="flex items-center gap-1 text-[10px] text-white font-mono px-0.5">
            <Check className="h-3 w-3 text-white" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Copied</span>
          </span>
        ) : (
          <Copy className="h-3 w-3 text-neutral-400" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
