'use client';
import { useMemo } from 'react';

// ── Inline SVG Portfolio Sparkline ────────────────────────────────────────
// Renders a 14-day synthetic price path ending at the current portfolio value.
// Uses a seeded pseudo-random walk so the shape is stable between renders
// but visually plausible.
export function PortfolioSparkline({
  value, width = 140, height = 44,
}: { value: number; width?: number; height?: number }) {
  const points = useMemo(() => {
    // 14 data points; final point is always the real portfolio value.
    // The walk is generated from a deterministic seed derived from the value
    // so it does not flicker on re-renders.
    const seed  = Math.floor(value * 0.01) || 1;
    const rand  = (n: number) => ((Math.sin(n * seed * 9301 + 49297) * 233280) % 1 + 1) / 2;
    const raw   = Array.from({ length: 13 }, (_, i) => rand(i + 1));
    // Scale so the final point is the real value; shape is proportional
    const scale = value > 0 ? value / (raw[raw.length - 1] * 1.05 + 0.001) : 1;
    return [...raw.map(p => p * scale), value];
  }, [value]);

  const minV  = Math.min(...points);
  const maxV  = Math.max(...points) || 1;
  const range = maxV - minV || 1;
  const PAD   = 4;

  const toX = (i: number) => PAD + (i / (points.length - 1)) * (width - PAD * 2);
  const toY = (v: number) => (height - PAD) - ((v - minV) / range) * (height - PAD * 2);

  const linePts = points.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPts = `${toX(0)},${height} ${linePts} ${toX(points.length - 1)},${height}`;

  const isUp = points[points.length - 1] >= points[0];
  const lineColor = isUp ? '#22c55e' : '#ef4444';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={lineColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0"   />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon points={areaPts} fill="url(#sparkGrad)" />
      {/* Line */}
      <polyline
        points={linePts}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Final dot */}
      <circle
        cx={toX(points.length - 1)}
        cy={toY(points[points.length - 1])}
        r="2.5"
        fill={lineColor}
      />
    </svg>
  );
}
