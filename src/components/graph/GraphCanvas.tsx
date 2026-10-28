'use client';
import { useId, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { GraphAccount, GraphSnapshot, GraphTransfer } from '@/types/graph';
import { Button } from '@/components/ui';

type Point = { x: number; y: number };
export function GraphCanvas({ graph, highlighted, selected, onAccount, onTransfer }: { graph: GraphSnapshot; highlighted: string[]; selected: string | null; onAccount: (a: GraphAccount) => void; onTransfer: (t: GraphTransfer) => void }) {
  const svg = useRef<SVGSVGElement>(null), drag = useRef<{ id: string | null; start: Point; origin: Point } | null>(null);
  const [moved, setMoved] = useState<Record<string, Point>>({}), [zoom, setZoom] = useState(1), [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const marker = useId().replaceAll(':', '');
  const positions = useMemo(() => {
    const ordered = [...graph.nodes].sort((a,b) => a.accountNumber.localeCompare(b.accountNumber));
    return Object.fromEntries(ordered.map((node,i) => { const angle = i * 2 * Math.PI / ordered.length - Math.PI / 2; const radius = ordered.length <= 8 ? 180 : 220; return [node.id, { x: 400 + Math.cos(angle) * radius * 1.35, y: 290 + Math.sin(angle) * radius }]; }));
  }, [graph.nodes]);
  const points = { ...positions, ...moved };
  const hot = new Set(highlighted);
  const hotNodes = new Set(graph.edges.filter(e => hot.has(e.id)).flatMap(e => [e.source,e.target]));
  const coordinate = (event: React.PointerEvent<SVGElement>): Point => {
    const matrix = svg.current?.getScreenCTM();
    const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix?.inverse());
    return { x: point.x, y: point.y };
  };
  return <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:20px_20px]">
    <div className="absolute left-4 top-4 z-10 flex gap-1 rounded-lg border border-neutral-700 bg-black/90 p-1"><Button variant="ghost" size="sm" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3,z*1.2))}><ZoomIn className="h-4 w-4"/></Button><Button variant="ghost" size="sm" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.4,z/1.2))}><ZoomOut className="h-4 w-4"/></Button><Button variant="ghost" size="sm" aria-label="Reset graph layout" onClick={() => { setZoom(1);setPan({x:0,y:0});setMoved({}); }}><Maximize2 className="h-4 w-4"/></Button></div>
    <svg ref={svg} viewBox="0 0 800 580" role="group" aria-label="Directed financial transaction network. Select accounts or transfers for details." className="min-h-[440px] w-full touch-none select-none" onPointerDown={e => { if (e.target === e.currentTarget) { drag.current = { id:null, start:coordinate(e), origin:pan }; e.currentTarget.setPointerCapture(e.pointerId); } }} onPointerMove={e => { const current = drag.current; if (!current) return; const p=coordinate(e), dx=p.x-current.start.x, dy=p.y-current.start.y; if(current.id) setMoved(v => ({ ...v, [current.id!]: { x:current.origin.x+dx/zoom,y:current.origin.y+dy/zoom } })); else setPan({ x:current.origin.x+dx,y:current.origin.y+dy }); }} onPointerUp={() => { drag.current=null; }} onPointerCancel={() => { drag.current=null; }}>
      <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>
      <g transform={`translate(${400+pan.x} ${290+pan.y}) scale(${zoom}) translate(-400 -290)`}>
        {graph.edges.map((edge,i) => { const a=points[edge.source],b=points[edge.target];if(!a||!b)return null;const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;const curve=((i%5)-2)*10;const path=`M ${a.x+dx/len*17} ${a.y+dy/len*17} Q ${(a.x+b.x)/2-dy/len*curve} ${(a.y+b.y)/2+dx/len*curve} ${b.x-dx/len*21} ${b.y-dy/len*21}`;return <g key={edge.id} role="button" tabIndex={0} aria-label={`Transfer ${edge.amount} ${edge.currency}`} onClick={() => onTransfer(edge)} onKeyDown={e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();onTransfer(edge);} }} className="cursor-pointer"><path d={path} stroke="transparent" fill="none" strokeWidth="12"/><path d={path} stroke={hot.has(edge.id)?'#fb923c':selected===edge.id?'#fafafa':'#525252'} strokeOpacity={hot.size&&!hot.has(edge.id)?.25:.8} strokeWidth={hot.has(edge.id)?3:1.4} markerEnd={`url(#${marker})`} fill="none" pointerEvents="none"/></g>; })}
        {graph.nodes.map(node => { const p=points[node.id]; if(!p)return null;const active=selected===node.id;return <g key={node.id} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label={`${node.accountNumber}, ${node.customerName}`} className="cursor-grab outline-none focus:opacity-70" onPointerDown={e => { e.stopPropagation();drag.current={id:node.id,start:coordinate(e),origin:p};svg.current?.setPointerCapture(e.pointerId);onAccount(node); }} onKeyDown={e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();onAccount(node);}}}><circle r={active?19:15} fill={hotNodes.has(node.id)?'#7c2d12':active?'#f5f5f5':'#171717'} stroke={hotNodes.has(node.id)?'#fb923c':active?'#fff':'#a3a3a3'} strokeWidth={active?2.5:1.5}/><text textAnchor="middle" y="4" fontSize="9" fill={active&&!hotNodes.has(node.id)?'#171717':'#e5e5e5'}>{node.accountNumber.slice(-4)}</text><text textAnchor="middle" y="32" fontSize="9" fill="#a3a3a3">{node.accountNumber.replace('SYNTH-ACC-IN-','ACC-')}</text></g>; })}
      </g>
    </svg><div className="pointer-events-none absolute bottom-3 left-4 text-[10px] text-neutral-500">Drag accounts to rearrange · Drag background to pan · Arrows show fund direction</div>
  </div>;
}
