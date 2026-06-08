'use client';

import React, {
  useState, useRef, useEffect, useCallback, forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Layers, Cpu, Grid3X3, Box, Download, Keyboard,
  Info, Zap, RefreshCw, BookOpen, ZoomIn, ZoomOut,
  RotateCcw, Edit2, Check, X,
} from 'lucide-react';
import { PanelLoader, PanelEmpty } from './CompliancePanel';
import { Building3DView } from './Building3DView';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────
export interface Room {
  id: string; name: string; type: string;
  width: number; height: number; x: number; y: number; area_sqm: number;
}
export interface Connection { from: string; to: string; type: string; }
export interface EgressPoint { id: string; x: number; y: number; type: string; }
export interface BuildResult {
  building_name: string; building_type: string; total_area_sqm: number;
  floors: number; style: string; description: string;
  rooms: Room[]; connections: Connection[]; egress_points: EgressPoint[];
  accessibility_notes: string; estimated_cost_usd: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Room type colour palette
// ─────────────────────────────────────────────────────────────────────────────
export const ROOM_COLORS: Record<string, {
  fill: string; border: string; label: string; hex: number;
}> = {
  bedroom:  { fill:'rgba(59,130,246,0.17)',  border:'#3b82f6', label:'#93c5fd', hex:0x3b82f6 },
  bathroom: { fill:'rgba(6,182,212,0.17)',   border:'#06b6d4', label:'#67e8f9', hex:0x06b6d4 },
  kitchen:  { fill:'rgba(245,158,11,0.17)',  border:'#f59e0b', label:'#fcd34d', hex:0xf59e0b },
  living:   { fill:'rgba(163,126,44,0.17)',  border:'#a37e2c', label:'#d4a843', hex:0xa37e2c },
  dining:   { fill:'rgba(139,92,246,0.17)',  border:'#8b5cf6', label:'#c4b5fd', hex:0x8b5cf6 },
  corridor: { fill:'rgba(107,114,128,0.11)', border:'#6b7280', label:'#9ca3af', hex:0x6b7280 },
  office:   { fill:'rgba(34,197,94,0.17)',   border:'#22c55e', label:'#86efac', hex:0x22c55e },
  storage:  { fill:'rgba(100,116,139,0.11)', border:'#64748b', label:'#94a3b8', hex:0x64748b },
  entrance: { fill:'rgba(251,191,36,0.17)',  border:'#fbbf24', label:'#fde68a', hex:0xfbbf24 },
  default:  { fill:'rgba(255,255,255,0.04)', border:'#374151', label:'#9ca3af', hex:0x374151 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built templates — load instantly without an API call
// ─────────────────────────────────────────────────────────────────────────────
type Template = BuildResult & { templateLabel: string; templateDesc: string };

const TEMPLATES: Record<string, Template> = {
  'modern-3br': {
    templateLabel:'Modern 3BR House', templateDesc:'3 bed, 2 bath, open-plan, 148 m²',
    building_name:'Modern Residence', building_type:'residential',
    total_area_sqm:148, floors:1, style:'modern',
    description:'A modern three-bedroom family home with open-plan living and garden entrance.',
    rooms:[
      {id:'r1', name:'Living Room',   type:'living',   width:6,height:5,x:0, y:0, area_sqm:30},
      {id:'r2', name:'Kitchen',       type:'kitchen',  width:4,height:4,x:6, y:0, area_sqm:16},
      {id:'r3', name:'Dining Room',   type:'dining',   width:4,height:3,x:6, y:4, area_sqm:12},
      {id:'r4', name:'Corridor',      type:'corridor', width:2,height:8,x:10,y:0, area_sqm:16},
      {id:'r5', name:'Master Bedroom',type:'bedroom',  width:4,height:4,x:12,y:0, area_sqm:16},
      {id:'r6', name:'Bedroom 2',     type:'bedroom',  width:4,height:4,x:12,y:4, area_sqm:16},
      {id:'r7', name:'Bedroom 3',     type:'bedroom',  width:3,height:4,x:16,y:0, area_sqm:12},
      {id:'r8', name:'Bathroom 1',    type:'bathroom', width:2,height:3,x:16,y:4, area_sqm:6 },
      {id:'r9', name:'Entrance',      type:'entrance', width:3,height:2,x:0, y:5, area_sqm:6 },
      {id:'r10',name:'Storage',       type:'storage',  width:2,height:2,x:0, y:7, area_sqm:4 },
    ],
    connections:[
      {from:'r1',to:'r2',type:'opening'},{from:'r1',to:'r9',type:'door'},
      {from:'r1',to:'r4',type:'door'},{from:'r2',to:'r3',type:'opening'},
      {from:'r4',to:'r5',type:'door'},{from:'r4',to:'r6',type:'door'},
      {from:'r4',to:'r7',type:'door'},{from:'r6',to:'r8',type:'door'},
    ],
    egress_points:[{id:'exit_1',x:0,y:5,type:'main_entrance'},{id:'exit_2',x:18,y:4,type:'emergency_exit'}],
    accessibility_notes:'All corridors exceed 1.2m UDA minimum. Accessible entrance with ramp provision.',
    estimated_cost_usd:82000,
  },
  'office-suite': {
    templateLabel:'Commercial Office Suite', templateDesc:'5 offices, meeting room, 210 m²',
    building_name:'Office Suite', building_type:'commercial',
    total_area_sqm:210, floors:1, style:'commercial',
    description:'An open-plan commercial office with 5 private offices and full amenities.',
    rooms:[
      {id:'r1', name:'Reception',    type:'entrance', width:5,height:4,x:0, y:0, area_sqm:20},
      {id:'r2', name:'Open Plan',    type:'office',   width:8,height:6,x:5, y:0, area_sqm:48},
      {id:'r3', name:'Meeting Room', type:'dining',   width:5,height:4,x:0, y:4, area_sqm:20},
      {id:'r4', name:'Office A',     type:'office',   width:3,height:4,x:13,y:0, area_sqm:12},
      {id:'r5', name:'Office B',     type:'office',   width:3,height:4,x:13,y:4, area_sqm:12},
      {id:'r6', name:'Office C',     type:'office',   width:3,height:4,x:16,y:0, area_sqm:12},
      {id:'r7', name:'Corridor',     type:'corridor', width:2,height:8,x:11,y:0, area_sqm:16},
      {id:'r8', name:'Bathroom (M)', type:'bathroom', width:3,height:3,x:5, y:6, area_sqm:9 },
      {id:'r9', name:'Bathroom (F)', type:'bathroom', width:3,height:3,x:8, y:6, area_sqm:9 },
      {id:'r10',name:'Server Room',  type:'storage',  width:3,height:2,x:16,y:4, area_sqm:6 },
    ],
    connections:[
      {from:'r1',to:'r2',type:'opening'},{from:'r1',to:'r3',type:'door'},
      {from:'r2',to:'r7',type:'opening'},{from:'r7',to:'r4',type:'door'},
      {from:'r7',to:'r5',type:'door'},{from:'r7',to:'r6',type:'door'},
      {from:'r2',to:'r8',type:'door'},{from:'r2',to:'r9',type:'door'},
    ],
    egress_points:[{id:'exit_1',x:0,y:0,type:'main_entrance'},{id:'exit_2',x:19,y:4,type:'emergency_exit'}],
    accessibility_notes:'Accessible WC 2200×2200mm. Main entrance automatic sliding doors. Tactile guidance at reception.',
    estimated_cost_usd:145000,
  },
  'sl-walauwa': {
    templateLabel:'Sri Lankan Walauwa', templateDesc:'Traditional courtyard house, 195 m²',
    building_name:'Traditional Walauwa', building_type:'residential',
    total_area_sqm:195, floors:1, style:'traditional',
    description:'A traditional Sri Lankan walauwa with central courtyard, verandah, and three bedrooms.',
    rooms:[
      {id:'r1', name:'Front Verandah', type:'entrance', width:8,height:3,x:2, y:0, area_sqm:24},
      {id:'r2', name:'Courtyard',      type:'living',   width:6,height:5,x:4, y:3, area_sqm:30},
      {id:'r3', name:'Main Hall',      type:'dining',   width:8,height:4,x:2, y:8, area_sqm:32},
      {id:'r4', name:'Kitchen',        type:'kitchen',  width:4,height:4,x:0, y:3, area_sqm:16},
      {id:'r5', name:'Pantry',         type:'storage',  width:2,height:3,x:0, y:7, area_sqm:6 },
      {id:'r6', name:'Master Bedroom', type:'bedroom',  width:4,height:4,x:10,y:3, area_sqm:16},
      {id:'r7', name:'Bedroom 2',      type:'bedroom',  width:4,height:3,x:10,y:7, area_sqm:12},
      {id:'r8', name:'Bedroom 3',      type:'bedroom',  width:3,height:3,x:2, y:12,area_sqm:9 },
      {id:'r9', name:'Bathroom',       type:'bathroom', width:3,height:3,x:7, y:12,area_sqm:9 },
      {id:'r10',name:'Well House',     type:'storage',  width:2,height:2,x:14,y:3, area_sqm:4 },
    ],
    connections:[
      {from:'r1',to:'r2',type:'door'},{from:'r2',to:'r3',type:'opening'},
      {from:'r2',to:'r6',type:'door'},{from:'r2',to:'r4',type:'door'},
      {from:'r4',to:'r5',type:'door'},{from:'r6',to:'r7',type:'door'},
      {from:'r3',to:'r8',type:'door'},{from:'r3',to:'r9',type:'door'},
    ],
    egress_points:[{id:'exit_1',x:2,y:0,type:'main_entrance'},{id:'exit_2',x:14,y:8,type:'emergency_exit'}],
    accessibility_notes:'Shallow step at verandah entry requires ramp for full UDA compliance. Courtyard provides natural light and ventilation.',
    estimated_cost_usd:68000,
  },
  'medical-clinic': {
    templateLabel:'Medical Clinic', templateDesc:'4 consult rooms + pharmacy, 180 m²',
    building_name:'Medical Clinic', building_type:'commercial',
    total_area_sqm:180, floors:1, style:'commercial',
    description:'A compact medical clinic with 4 consulting rooms, waiting area, and pharmacy.',
    rooms:[
      {id:'r1', name:'Waiting Area',   type:'living',   width:6,height:5,x:0, y:0, area_sqm:30},
      {id:'r2', name:'Reception',      type:'office',   width:4,height:3,x:6, y:0, area_sqm:12},
      {id:'r3', name:'Corridor',       type:'corridor', width:2,height:8,x:10,y:0, area_sqm:16},
      {id:'r4', name:'Consult Room 1', type:'office',   width:4,height:4,x:12,y:0, area_sqm:16},
      {id:'r5', name:'Consult Room 2', type:'office',   width:4,height:4,x:12,y:4, area_sqm:16},
      {id:'r6', name:'Consult Room 3', type:'office',   width:4,height:4,x:16,y:0, area_sqm:16},
      {id:'r7', name:'Consult Room 4', type:'office',   width:4,height:4,x:16,y:4, area_sqm:16},
      {id:'r8', name:'Pharmacy',       type:'storage',  width:4,height:3,x:6, y:3, area_sqm:12},
      {id:'r9', name:'Accessible WC',  type:'bathroom', width:3,height:3,x:0, y:5, area_sqm:9 },
      {id:'r10',name:'Staff Room',     type:'dining',   width:3,height:3,x:0, y:8, area_sqm:9 },
    ],
    connections:[
      {from:'r1',to:'r2',type:'opening'},{from:'r1',to:'r9',type:'door'},
      {from:'r2',to:'r3',type:'door'},{from:'r3',to:'r4',type:'door'},
      {from:'r3',to:'r5',type:'door'},{from:'r3',to:'r6',type:'door'},
      {from:'r3',to:'r7',type:'door'},{from:'r2',to:'r8',type:'door'},
    ],
    egress_points:[{id:'exit_1',x:0,y:0,type:'main_entrance'},{id:'exit_2',x:20,y:4,type:'emergency_exit'}],
    accessibility_notes:'Accessible WC 2200×2200mm per UDA Section 9.1.1. All consult room doors 900mm clear. Tactile path from entrance to reception.',
    estimated_cost_usd:115000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG export — generates a downloadable architectural floor plan SVG
// ─────────────────────────────────────────────────────────────────────────────
function exportSVG(result: BuildResult, unitFactor: number, unitLabel: string) {
  const rooms  = result.rooms;
  const minX   = Math.min(...rooms.map(r => r.x));
  const minY   = Math.min(...rooms.map(r => r.y));
  const maxX   = Math.max(...rooms.map(r => r.x + r.width));
  const maxY   = Math.max(...rooms.map(r => r.y + r.height));
  const S      = 50; // 50 px per metre
  const PAD    = 64;
  const W      = (maxX - minX) * S + PAD * 2;
  const H      = (maxY - minY) * S + PAD * 2;

  const tX = (x: number) => (x - minX) * S + PAD;
  const tY = (y: number) => (y - minY) * S + PAD;

  const connections = (result.connections ?? []).map(c => {
    const fr = rooms.find(r => r.id === c.from), tr = rooms.find(r => r.id === c.to);
    if (!fr || !tr) return '';
    return `<line x1="${tX(fr.x+fr.width/2)}" y1="${tY(fr.y+fr.height/2)}" x2="${tX(tr.x+tr.width/2)}" y2="${tY(tr.y+tr.height/2)}" stroke="rgba(163,126,44,0.35)" stroke-width="1.2" stroke-dasharray="5,4"/>`;
  }).join('\n');

  const roomRects = rooms.map(room => {
    const col  = ROOM_COLORS[room.type] ?? ROOM_COLORS.default;
    const rx   = tX(room.x), ry = tY(room.y);
    const rw   = room.width * S, rh = room.height * S;
    const area = (room.area_sqm * unitFactor * unitFactor).toFixed(0);
    // Replace rgba(...) fill shorthand for SVG compatibility
    const fillSvg = col.fill.replace(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/, (_m,r,g,b,a) =>
      `rgba(${r},${g},${b},${parseFloat(a)*1.8})`);
    return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${fillSvg}" stroke="${col.border}" stroke-width="1.5"/>
<text x="${rx+rw/2}" y="${ry+rh/2-7}" text-anchor="middle" dominant-baseline="middle" font-family="Courier New" font-size="11" font-weight="700" fill="${col.label}">${room.name.toUpperCase()}</text>
<text x="${rx+rw/2}" y="${ry+rh/2+8}" text-anchor="middle" dominant-baseline="middle" font-family="Courier New" font-size="8" fill="${col.label}99">${area}${unitLabel}²</text>`;
  }).join('\n');

  const egress = (result.egress_points ?? []).map(ep => {
    const ex = tX(ep.x), ey = tY(ep.y);
    return `<circle cx="${ex}" cy="${ey}" r="12" fill="rgba(34,197,94,0.15)" stroke="#22c55e" stroke-width="2"/>
<text x="${ex}" y="${ey}" text-anchor="middle" dominant-baseline="middle" font-family="Courier New" font-size="7" font-weight="700" fill="#22c55e">EXIT</text>`;
  }).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#030303"/>
  <defs>
    <pattern id="grid" width="${S}" height="${S}" patternUnits="userSpaceOnUse">
      <path d="M ${S} 0 L 0 0 0 ${S}" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  ${connections}
  ${roomRects}
  ${egress}
  <text x="${PAD}" y="30" font-family="Courier New" font-size="13" font-weight="900" fill="#a37e2c" letter-spacing="3">${result.building_name.toUpperCase()} · ARCHIONLABS</text>
  <text x="${W-PAD}" y="30" font-family="Courier New" font-size="8" fill="#52525b" text-anchor="end">${new Date().toLocaleDateString()} · ${result.total_area_sqm} m² · ${result.floors} floor(s)</text>
  <g transform="translate(${W-30},32)">
    <line x1="0" y1="10" x2="0" y2="-10" stroke="#a37e2c" stroke-width="1.5"/>
    <polygon points="0,-10 -4,-3 4,-3" fill="#a37e2c"/>
    <text x="0" y="22" text-anchor="middle" font-family="Courier New" font-size="8" font-weight="700" fill="#a37e2c">N</text>
  </g>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), {
    href: url,
    download: `archion-${result.building_name.toLowerCase().replace(/\s+/g, '-')}.svg`,
  }).click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2D Canvas — fully self-contained with zoom, pan, room selection
// ─────────────────────────────────────────────────────────────────────────────
interface Canvas2DHandle { reset: () => void; }

const FloorPlanCanvas2D = forwardRef<Canvas2DHandle, {
  result: BuildResult;
  selectedRoom: string | null;
  onSelectRoom: (id: string | null) => void;
  unitFactor: number;
  unitLabel: string;
}>(function FloorPlanCanvas2D({ result, selectedRoom, onSelectRoom, unitFactor, unitLabel }, fwdRef) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport stored in a ref — mutations never trigger React re-renders.
  // We call draw() directly whenever the viewport changes, which is more
  // efficient than using useState and re-rendering the whole component.
  const vpRef = useRef({ zoom: 1, panX: 0, panY: 0 });

  // Geometry refs shared between draw() and the click-to-select logic.
  const geomRef = useRef({ baseS: 1, baseOX: 0, baseOY: 0, minX: 0, minY: 0 });

  // Drag tracking
  const drag = useRef({ active: false, startX: 0, startY: 0, origPanX: 0, origPanY: 0 });
  const click = useRef({ startX: 0, startY: 0, startT: 0 });

  // ── Core draw function ────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result?.rooms?.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Dot-grid background
    ctx.fillStyle = 'rgba(255,255,255,0.022)';
    for (let x = 0; x < W; x += 22) for (let y = 0; y < H; y += 22) ctx.fillRect(x, y, 1, 1);

    const rooms  = result.rooms;
    const minX   = Math.min(...rooms.map(r => r.x));
    const minY   = Math.min(...rooms.map(r => r.y));
    const maxX   = Math.max(...rooms.map(r => r.x + r.width));
    const maxY   = Math.max(...rooms.map(r => r.y + r.height));
    const planW  = maxX - minX, planH = maxY - minY;

    const PAD    = 54;
    const baseS  = Math.min((W - PAD * 2) / planW, (H - PAD * 2) / planH);
    const baseOX = PAD + (W - PAD * 2 - planW * baseS) / 2;
    const baseOY = PAD + (H - PAD * 2 - planH * baseS) / 2;

    // Cache geometry for click-detection (used in handleMouseUp)
    geomRef.current = { baseS, baseOX, baseOY, minX, minY };

    const vp = vpRef.current;
    const s  = baseS * vp.zoom;
    const ox = baseOX * vp.zoom + vp.panX;
    const oy = baseOY * vp.zoom + vp.panY;

    const cx = (x: number) => ox + (x - minX) * s;
    const cy = (y: number) => oy + (y - minY) * s;

    // Connection lines (drawn first, under rooms)
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    (result.connections ?? []).forEach(c => {
      const fr = rooms.find(r => r.id === c.from);
      const tr = rooms.find(r => r.id === c.to);
      if (!fr || !tr) return;
      ctx.strokeStyle = 'rgba(163,126,44,0.2)';
      ctx.beginPath();
      ctx.moveTo(cx(fr.x + fr.width / 2), cy(fr.y + fr.height / 2));
      ctx.lineTo(cx(tr.x + tr.width / 2), cy(tr.y + tr.height / 2));
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Rooms
    rooms.forEach(room => {
      const col = ROOM_COLORS[room.type] ?? ROOM_COLORS.default;
      const rx  = cx(room.x), ry = cy(room.y);
      const rw  = room.width * s, rh = room.height * s;
      const sel = selectedRoom === room.id;

      // Fill
      ctx.fillStyle = sel ? col.border + '3A' : col.fill;
      ctx.fillRect(rx, ry, rw, rh);

      // Border
      ctx.strokeStyle = sel ? col.border : col.border + '88';
      ctx.lineWidth   = sel ? 2 : 1;
      ctx.strokeRect(rx, ry, rw, rh);

      // Architectural corner ticks — give rooms a drafted feel
      if (rw > 24 && rh > 24) {
        const t = Math.min(8, rw / 5, rh / 5);
        ctx.strokeStyle = col.border + '22';
        ctx.lineWidth   = 0.5;
        ctx.beginPath();
        [[0,0],[1,0],[0,1],[1,1]].forEach(([i, j]) => {
          const bx = rx + i * rw, by = ry + j * rh;
          const sx = i ? -1 : 1,  sy = j ? -1 : 1;
          ctx.moveTo(bx + sx * t, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + sy * t);
        });
        ctx.stroke();
      }

      // Name + area labels
      if (rw > 26 && rh > 18) {
        const fs = Math.max(6.5, Math.min(10.5, rw / (room.name.length + 1) * 1.5));
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.fillStyle     = col.label;
        ctx.font          = `700 ${fs}px "Courier New",monospace`;
        ctx.fillText(room.name.toUpperCase(), rx + rw / 2, ry + rh / 2 - fs * 0.7);
        ctx.fillStyle = col.label + '88';
        ctx.font      = `${fs - 1.5}px "Courier New",monospace`;
        const area    = (room.area_sqm * unitFactor * unitFactor).toFixed(unitFactor === 1 ? 0 : 1);
        ctx.fillText(`${area}${unitLabel}²`, rx + rw / 2, ry + rh / 2 + fs * 0.7);
      }

      // Selection ring
      if (sel) {
        ctx.strokeStyle = col.border + 'BB';
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(rx - 4, ry - 4, rw + 8, rh + 8);
        ctx.setLineDash([]);
      }
    });

    // Egress markers
    (result.egress_points ?? []).forEach(ep => {
      const ex = cx(ep.x), ey = cy(ep.y);
      ctx.beginPath();
      ctx.arc(ex, ey, 9, 0, Math.PI * 2);
      ctx.fillStyle   = '#22c55e1A';
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.fillStyle     = '#22c55e';
      ctx.font          = 'bold 6px monospace';
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'middle';
      ctx.fillText('EXIT', ex, ey);
    });

    // North arrow
    ctx.save();
    ctx.translate(W - 28, 28);
    ctx.strokeStyle = '#a37e2c';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-4, -3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(4, -3);  ctx.stroke();
    ctx.fillStyle     = '#a37e2c';
    ctx.font          = 'bold 8px monospace';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'alphabetic';
    ctx.fillText('N', 0, 20);
    ctx.restore();

    // Scale bar
    const barM  = Math.max(1, Math.round(3.5 / (baseS * vp.zoom)));
    const barPx = barM * baseS * vp.zoom;
    ctx.fillStyle = '#a37e2c';
    ctx.fillRect(PAD, H - 15, barPx, 2);
    ctx.font      = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${(barM * unitFactor).toFixed(unitFactor === 1 ? 0 : 1)}${unitLabel}`,
      PAD + barPx / 2, H - 20,
    );

    // Zoom level badge
    if (Math.abs(vp.zoom - 1) > 0.05) {
      ctx.fillStyle   = 'rgba(163,126,44,0.6)';
      ctx.font        = '7px monospace';
      ctx.textAlign   = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`×${vp.zoom.toFixed(1)}`, W - 10, H - 10);
    }
  }, [result, selectedRoom, unitFactor, unitLabel]);

  // Expose reset() to parent via ref
  useImperativeHandle(fwdRef, () => ({
    reset: () => {
      vpRef.current = { zoom: 1, panX: 0, panY: 0 };
      draw();
    },
  }), [draw]);

  // Resize observer — keeps canvas pixel size synced with CSS size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    });
    ro.observe(canvas);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  // Reset viewport when result changes (new plan loaded)
  useEffect(() => {
    vpRef.current = { zoom: 1, panX: 0, panY: 0 };
    draw();
  }, [result, draw]);

  // Wheel zoom — must be non-passive so we can call preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.87 : 1.15;
      vpRef.current.zoom = Math.max(0.25, Math.min(14, vpRef.current.zoom * factor));
      draw();
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [draw]);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    drag.current  = { active: true, startX: e.clientX, startY: e.clientY, origPanX: vpRef.current.panX, origPanY: vpRef.current.panY };
    click.current = { startX: e.clientX, startY: e.clientY, startT: Date.now() };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drag.current.active) return;
    vpRef.current.panX = drag.current.origPanX + (e.clientX - drag.current.startX);
    vpRef.current.panY = drag.current.origPanY + (e.clientY - drag.current.startY);
    draw();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drag.current.active = false;
    const dx = e.clientX - click.current.startX;
    const dy = e.clientY - click.current.startY;
    const dt = Date.now() - click.current.startT;

    // Treat as click if barely moved and fast (< 300 ms, < 6 px)
    if (Math.sqrt(dx * dx + dy * dy) < 6 && dt < 300) {
      const canvas = canvasRef.current;
      if (!canvas || !result?.rooms?.length) return;

      const rect  = canvas.getBoundingClientRect();
      const pixX  = (e.clientX - rect.left) * (canvas.width  / rect.width);
      const pixY  = (e.clientY - rect.top)  * (canvas.height / rect.height);

      // Convert canvas pixel → world grid coordinate
      const { baseS, baseOX, baseOY, minX, minY } = geomRef.current;
      const vp = vpRef.current;
      const s  = baseS * vp.zoom;
      const ox = baseOX * vp.zoom + vp.panX;
      const oy = baseOY * vp.zoom + vp.panY;
      const wx = (pixX - ox) / s + minX;
      const wy = (pixY - oy) / s + minY;

      let hit: string | null = null;
      for (const room of result.rooms) {
        if (wx >= room.x && wx <= room.x + room.width && wy >= room.y && wy <= room.y + room.height) {
          hit = room.id; break;
        }
      }
      onSelectRoom(hit === selectedRoom ? null : hit);
    }
  };

  // Internal zoom controls rendered as an overlay inside the canvas wrapper
  const zoomBy = (factor: number) => {
    vpRef.current.zoom = Math.max(0.25, Math.min(14, vpRef.current.zoom * factor));
    draw();
  };
  const resetVp = () => { vpRef.current = { zoom: 1, panX: 0, panY: 0 }; draw(); };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full cursor-crosshair block select-none"
        style={{ imageRendering: 'crisp-edges' }}
      />
      {/* Floating zoom controls — bottom-right of canvas */}
      <div className="absolute bottom-3 right-3 flex gap-1 z-10">
        {[
          { Icon: ZoomIn,   action: () => zoomBy(1.25), title: 'Zoom in' },
          { Icon: ZoomOut,  action: () => zoomBy(0.80), title: 'Zoom out' },
          { Icon: RotateCcw,action: resetVp,             title: 'Reset view' },
        ].map(({ Icon, action, title }) => (
          <button
            key={title}
            onClick={action}
            title={title}
            className="w-7 h-7 flex items-center justify-center bg-black/70 border border-[var(--border-dark)] text-[var(--text-muted)] hover:text-[var(--rolex-gold)] hover:border-[var(--rolex-gold)]/40 transition-colors backdrop-blur-sm"
          >
            <Icon size={10} />
          </button>
        ))}
      </div>
    </div>
  );
});



// ─────────────────────────────────────────────────────────────────────────────
// Main BuildPanel
// ─────────────────────────────────────────────────────────────────────────────
export function BuildPanel({
  result, loading, onGenerate,
}: {
  result: BuildResult | null;
  loading: boolean;
  onGenerate: (description: string, style: string) => void;
}) {
  const [description,   setDescription]   = useState('');
  const [style,         setStyle]         = useState('modern');
  const [view,          setView]          = useState<'2d' | '3d'>('2d');
  const [selectedRoom,  setSelectedRoom]  = useState<string | null>(null);
  const [unit,          setUnit]          = useState<'m' | 'ft'>('m');
  const [showTemplates, setShowTemplates] = useState(false);
  // localResult allows template loading to override the API result
  const [localResult,   setLocalResult]   = useState<BuildResult | null>(result);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editingName,   setEditingName]   = useState('');

  const canvas2DRef = useRef<Canvas2DHandle>(null);

  // Keep localResult in sync when parent pushes a new API result
  useEffect(() => { setLocalResult(result); }, [result]);

  const current      = localResult;
  const selectedData = current?.rooms?.find(r => r.id === selectedRoom);
  const unitFactor   = unit === 'm' ? 1 : 3.281;
  const unitLabel    = unit;

  // ESC → deselect / cancel rename
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedRoom(null); setEditingId(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const commitRename = () => {
    if (!editingId || !localResult) return;
    setLocalResult(prev => prev ? {
      ...prev,
      rooms: prev.rooms.map(r => r.id === editingId ? { ...r, name: editingName.trim() || r.name } : r),
    } : null);
    setEditingId(null);
  };

  const STYLE_OPTIONS = ['modern', 'traditional', 'commercial', 'industrial'] as const;
  const EXAMPLES = [
    'A 3-bedroom family home with open plan kitchen, 2 bathrooms, and a study',
    'Small commercial office with 4 private offices, reception, meeting room',
    'Sri Lankan traditional house with central courtyard, 3 bedrooms and verandah',
    'Medical clinic with 4 consulting rooms, waiting area, and accessible facilities',
  ];

  if (loading) return <PanelLoader label="Extracting Room Requirements & Generating Layout…" />;

  return (
    <div className="space-y-4">

      {/* ── NLP Input ──────────────────────────────────────────── */}
      <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={11} className="text-[var(--rolex-gold)]" />
          <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold">
            Natural Language Floor Plan Generator
          </p>
          <button
            onClick={() => setShowTemplates(s => !s)}
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 text-[8px] font-mono uppercase tracking-widest border transition-colors ${
              showTemplates
                ? 'border-[var(--rolex-gold)]/50 text-[var(--rolex-gold)] bg-[var(--rolex-gold)]/8'
                : 'border-[var(--border-dark)] text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <BookOpen size={9} /> Templates
          </button>
        </div>

        {/* Template gallery */}
        {showTemplates && (
          <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(TEMPLATES).map(([key, tmpl]) => (
              <button
                key={key}
                onClick={() => { setLocalResult(tmpl); setSelectedRoom(null); setShowTemplates(false); }}
                className="text-left p-3 border border-[var(--border-dark)] hover:border-[var(--rolex-gold)]/50 hover:bg-[var(--rolex-gold)]/5 transition-all group"
              >
                <p className="text-[8px] font-mono font-bold text-white group-hover:text-[var(--rolex-gold)] uppercase tracking-wide leading-tight mb-1">
                  {tmpl.templateLabel}
                </p>
                <p className="text-[7px] font-mono text-[var(--text-muted)]">{tmpl.templateDesc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Text area */}
        <div className="relative mb-3">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your building… e.g., 'A 3-bedroom family home with open plan kitchen, 2 bathrooms, and a study room'"
            className="w-full h-24 bg-black border border-[var(--border-dark)] text-white text-[11px] font-mono p-3 resize-none focus:outline-none focus:border-[var(--rolex-gold)] placeholder-white/20 transition-colors"
          />
          <span className={`absolute bottom-2 right-2 text-[7px] font-mono pointer-events-none ${description.length > 380 ? 'text-orange-400' : 'text-[var(--text-muted)]'}`}>
            {description.length}
          </span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Style selector */}
          <div className="flex gap-1.5 flex-wrap">
            {STYLE_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`text-[8px] font-mono uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                  style === s
                    ? 'border-[var(--rolex-gold)] text-[var(--rolex-gold)] bg-[var(--rolex-gold)]/10'
                    : 'border-[var(--border-dark)] text-[var(--text-muted)] hover:border-white/20'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => onGenerate(description, style)}
            disabled={!description.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-[var(--rolex-gold)] text-black text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Zap size={10} /> Generate →
          </button>
        </div>

        {/* Example prompts */}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setDescription(ex)}
              className="text-[7px] font-mono text-[var(--text-muted)] px-2 py-1 border border-[var(--border-dark)] hover:border-[var(--rolex-gold)]/40 hover:text-white/60 transition-colors"
            >
              Example {i + 1} ↗
            </button>
          ))}
        </div>
      </div>

      {!current && (
        <PanelEmpty
          label="ARCHION BUILD"
          description="Describe any building in plain English or load a template. AI extracts room requirements and generates a complete interactive 2D floor plan and 3D model."
        />
      )}

      {current && (
        <>
          {/* ── Stats strip ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
            {[
              { l: 'Building',  v: current.building_name },
              { l: 'Area',      v: `${(current.total_area_sqm * (unit==='ft'?10.764:1)).toFixed(0)} ${unit==='m'?'m²':'ft²'}` },
              { l: 'Rooms',     v: String(current.rooms?.length ?? 0) },
              { l: 'Floors',    v: String(current.floors) },
              { l: 'Est. Cost', v: `$${(current.estimated_cost_usd ?? 0).toLocaleString()}` },
            ].map(s => (
              <div key={s.l} className="bg-[#050505] p-3">
                <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">{s.l}</p>
                <p className="text-sm font-mono font-bold text-white truncate">{s.v}</p>
              </div>
            ))}
          </div>

          {/* ── View + unit + export toolbar ──────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 2D / 3D */}
            <div className="flex border border-[var(--border-dark)]">
              {([['2d', Grid3X3, '2D Plan'], ['3d', Box, '3D Model']] as const).map(([id, Icon, label]) => (
                <button key={id} onClick={() => setView(id as '2d' | '3d')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[8px] font-mono uppercase tracking-widest border-r border-[var(--border-dark)] last:border-r-0 transition-colors ${
                    view === id ? 'bg-[var(--rolex-gold)]/10 text-[var(--rolex-gold)]' : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  <Icon size={10} /> {label}
                </button>
              ))}
            </div>

            {/* Unit toggle */}
            <div className="flex border border-[var(--border-dark)]">
              {(['m', 'ft'] as const).map(u => (
                <button key={u} onClick={() => setUnit(u)}
                  className={`px-3 py-2 text-[8px] font-mono uppercase border-r border-[var(--border-dark)] last:border-r-0 tracking-widest transition-colors ${
                    unit === u ? 'bg-[var(--rolex-gold)]/10 text-[var(--rolex-gold)]' : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={() => exportSVG(current, unitFactor, unitLabel)}
                className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border-dark)] text-[var(--text-muted)] text-[8px] font-mono uppercase tracking-widest hover:text-[var(--rolex-gold)] hover:border-[var(--rolex-gold)]/40 transition-colors"
              >
                <Download size={9} /> SVG
              </button>
              <button
                onClick={() => onGenerate(description || current.description, style)}
                className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border-dark)] text-[var(--text-muted)] text-[8px] font-mono uppercase tracking-widest hover:text-white hover:border-white/20 transition-colors"
              >
                <RefreshCw size={9} /> Regen
              </button>
            </div>
          </div>

          {/* ── Canvas + side panel ──────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_255px] gap-4">
            {/* Canvas */}
            <div className="relative bg-black border border-[var(--border-dark)] overflow-hidden" style={{ height: 420 }}>
              <div className="absolute top-3 left-3 z-10 px-2 py-1 bg-black/80 border border-[var(--border-dark)] backdrop-blur-sm pointer-events-none">
                <p className="text-[7px] font-mono text-[var(--rolex-gold)] uppercase tracking-widest">
                  {view === '2d'
                    ? '2D PLAN · Scroll=zoom · Drag=pan · Click=select'
                    : '3D MODEL · Drag=orbit · Scroll=zoom · Dblclick=auto'}
                </p>
              </div>

              {view === '2d' ? (
                <FloorPlanCanvas2D
                  ref={canvas2DRef}
                  result={current}
                  selectedRoom={selectedRoom}
                  onSelectRoom={setSelectedRoom}
                  unitFactor={unitFactor}
                  unitLabel={unitLabel}
                />
              ) : (
                <Building3DView result={current} />
              )}
            </div>

            {/* Inspector / legend panel */}
            <div className="space-y-3">
              {selectedData ? (
                <div className="bg-[#050505] border border-[var(--rolex-gold)]/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 flex-shrink-0" style={{ background: ROOM_COLORS[selectedData.type]?.border || '#888' }} />
                    <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold">Selected Room</p>
                  </div>

                  {/* Inline rename */}
                  {editingId === selectedData.id ? (
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                        className="flex-1 bg-black border border-[var(--rolex-gold)] text-white text-xs font-mono px-2 py-1 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={commitRename} className="text-[var(--rolex-gold)] hover:text-white transition-colors"><Check size={12}/></button>
                      <button onClick={() => setEditingId(null)} className="text-[var(--text-muted)] hover:text-white transition-colors"><X size={12}/></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-white font-bold text-sm flex-1 truncate">{selectedData.name}</p>
                      <button
                        onClick={() => { setEditingId(selectedData.id); setEditingName(selectedData.name); }}
                        className="text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors flex-shrink-0"
                        title="Rename room"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {[
                      ['Type',   selectedData.type],
                      ['Width',  `${(selectedData.width  * unitFactor).toFixed(unitFactor===1?1:0)} ${unitLabel}`],
                      ['Depth',  `${(selectedData.height * unitFactor).toFixed(unitFactor===1?1:0)} ${unitLabel}`],
                      ['Area',   `${(selectedData.area_sqm * unitFactor * unitFactor).toFixed(0)} ${unitLabel}²`],
                      ['Grid',   `(${selectedData.x}, ${selectedData.y})`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[9px] font-mono border-b border-[var(--border-dark)] pb-1.5">
                        <span className="text-[var(--text-muted)]">{k}</span>
                        <span className="text-white capitalize">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#050505] border border-[var(--border-dark)] p-4">
                  <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-3 font-bold">Room Legend</p>
                  <div className="space-y-1.5">
                    {Object.entries(ROOM_COLORS).filter(([k]) => k !== 'default').map(([type, col]) => (
                      <div key={type} className="flex items-center gap-2">
                        <div className="w-3 h-3 border flex-shrink-0" style={{ background: col.fill, borderColor: col.border }} />
                        <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {current.accessibility_notes && (
                <div className="bg-[#050505] border border-[var(--border-dark)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={10} className="text-[var(--rolex-gold)] flex-shrink-0" />
                    <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">Accessibility</p>
                  </div>
                  <p className="text-[9px] text-white/55 leading-relaxed">{current.accessibility_notes}</p>
                </div>
              )}

              <div className="bg-[#050505] border border-[var(--border-dark)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Keyboard size={10} className="text-[var(--text-muted)]" />
                  <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">Controls</p>
                </div>
                <div className="space-y-1.5">
                  {[
                    ['Click room',  'Select + inspect'],
                    ['Edit icon',   'Rename room'],
                    ['Scroll',      'Zoom in/out'],
                    ['Drag',        'Pan canvas'],
                    ['ESC',         'Deselect'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[8px] font-mono">
                      <kbd className="px-1.5 py-0.5 bg-white/4 border border-[var(--border-dark)] text-white text-[7px]">{k}</kbd>
                      <span className="text-[var(--text-muted)]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Connections grid ────────────────────────────────── */}
          {current.connections?.length > 0 && (
            <div className="bg-[#050505] border border-[var(--border-dark)]">
              <div className="px-5 py-3 border-b border-[var(--border-dark)] bg-[#0A0A0A]">
                <p className="text-[8px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2">
                  <Layers size={11} className="text-[var(--rolex-gold)]" />
                  Room Connections ({current.connections.length})
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border-dark)]">
                {current.connections.map((conn, i) => {
                  const fr = current.rooms?.find(r => r.id === conn.from);
                  const tr = current.rooms?.find(r => r.id === conn.to);
                  return (
                    <div key={i} className="bg-[#050505] px-4 py-3 flex items-center gap-2 text-[8px] font-mono">
                      <span className="text-white/65 truncate">{fr?.name || conn.from}</span>
                      <span className="text-[var(--rolex-gold)] flex-shrink-0">—</span>
                      <span className="text-white/65 truncate">{tr?.name || conn.to}</span>
                      <span className="ml-auto text-[var(--text-muted)] text-[7px] uppercase flex-shrink-0">{conn.type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {current.description && (
            <p className="text-[9px] font-mono text-[var(--text-muted)] px-1 leading-relaxed">
              AI: {current.description}
            </p>
          )}
        </>
      )}
    </div>
  );
}
