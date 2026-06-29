"use client";

import { useCallback, useRef, useState } from "react";
import type { MacroSeries } from "@/lib/macro";

/**
 * Interactive SVG chart primitives for the market-context layer and the per-syndicate
 * profiles. Each chart is hover-aware: moving over a year reveals every series' exact
 * value in a tooltip, with a vertical guide and emphasised markers. Geometry is fixed
 * (viewBox), so charts scale fluidly; pointer coordinates are mapped in wrapper pixels.
 * All series render from plain MacroSeries data: no figure is introduced on the client.
 */

export const BANDS = ["#2563eb", "#0891b2", "#7c3aed", "#059669", "#d97706", "#db2777", "#475569"];
const W = 480, H = 240, L = 44, R = 12, T = 14, Bm = 30;
const X0 = L, X1 = W - R, Y0 = T, Y1 = H - Bm;

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, ""));

function cats(s: MacroSeries): string[] {
  return Array.from(new Set(s.points.map((p) => p.category)));
}
function yearsOf(s: MacroSeries): number[] {
  return Array.from(new Set(s.points.map((p) => p.year))).sort((a, b) => a - b);
}
function val(s: MacroSeries, c: string, y: number): number {
  return s.points.find((p) => p.category === c && p.year === y)?.value ?? 0;
}
function has(s: MacroSeries, c: string, y: number): boolean {
  return s.points.some((p) => p.category === c && p.year === y);
}

// ---- Hover tooltip primitive -------------------------------------------------

type TipLine = { label: string; value: string; color?: string };
type Tip = { x: number; y: number; w: number; title: string; lines: TipLine[] };

function useTip() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const show = useCallback((e: React.MouseEvent, title: string, lines: TipLine[]) => {
    const host = ref.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, title, lines });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  return { ref, tip, show, hide };
}

function TipBox({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const flip = tip.x > tip.w * 0.6;
  return (
    <div
      className="charttip"
      role="status"
      style={{ left: flip ? tip.x - 12 : tip.x + 12, top: tip.y, transform: `translateY(-50%)${flip ? " translateX(-100%)" : ""}` }}
    >
      <div className="charttip-t">{tip.title}</div>
      {tip.lines.map((l, i) => (
        <div key={i} className="charttip-r">
          {l.color ? <i style={{ background: l.color }} /> : null}
          <span>{l.label}</span>
          <b>{l.value}</b>
        </div>
      ))}
    </div>
  );
}

export function Legend({ labels }: { labels: string[] }) {
  if (labels.length <= 1) return null;
  return (
    <div className="macro-legend">
      {labels.map((c, ci) => (
        <span key={c}><i style={{ background: BANDS[ci % BANDS.length] }} />{c}</span>
      ))}
    </div>
  );
}

/** Single-series vertical columns (positive blue, negative red), hover per bar. */
export function ColumnChart({ s }: { s: MacroSeries }) {
  const { ref, tip, show, hide } = useTip();
  const [hot, setHot] = useState<number | null>(null);
  const pts = s.points.filter((p) => p.category === "").sort((a, b) => a.year - b.year);
  if (!pts.length) return null;
  const vmax = Math.max(0, ...pts.map((p) => p.value));
  const vmin = Math.min(0, ...pts.map((p) => p.value));
  const span = vmax - vmin || 1;
  const yOf = (v: number) => Y1 - ((v - vmin) / span) * (Y1 - Y0);
  const zeroY = yOf(0);
  const step = (X1 - X0) / pts.length;
  const bw = step * 0.62;
  return (
    <div className="chartwrap" ref={ref} onMouseLeave={() => { hide(); setHot(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
        <line className="scat-axis" x1={X0} y1={zeroY} x2={X1} y2={zeroY} />
        {pts.map((p, i) => {
          const cx = X0 + (i + 0.5) * step;
          const y = yOf(p.value);
          const top = Math.min(y, zeroY);
          const h = Math.max(1, Math.abs(y - zeroY));
          const on = hot === p.year;
          return (
            <g key={p.year}>
              <rect x={cx - bw / 2} y={top} width={bw} height={h} fill={p.value >= 0 ? "#2563eb" : "#dc2626"} opacity={hot == null || on ? 0.92 : 0.4} />
              <rect
                className="hit" x={X0 + i * step} y={Y0} width={step} height={Y1 - Y0} fill="transparent"
                onMouseMove={(e) => { show(e, String(p.year), [{ label: s.series_label, value: fmt(p.value), color: p.value >= 0 ? "#2563eb" : "#dc2626" }]); setHot(p.year); }}
              />
              <text className="mx" x={cx} y={H - 14} textAnchor="middle">{String(p.year).slice(2)}</text>
              <text className="mv" x={cx} y={p.value >= 0 ? top - 3 : top + h + 9} textAnchor="middle">{fmt(p.value)}</text>
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

/** Multi-category stacked area; hover a year reveals every category's value. */
export function StackedAreaChart({ s }: { s: MacroSeries }) {
  const { ref, tip, show, hide } = useTip();
  const [hotYi, setHotYi] = useState<number | null>(null);
  const cs = cats(s);
  const ys = yearsOf(s);
  if (!cs.length || !ys.length) return null;
  const totals = ys.map((y) => cs.reduce((sum, c) => sum + val(s, c, y), 0));
  const vmax = Math.max(1e-9, ...totals);
  const xOf = (i: number) => (ys.length === 1 ? X0 : X0 + (i / (ys.length - 1)) * (X1 - X0));
  const yOf = (v: number) => Y1 - (v / vmax) * (Y1 - Y0);
  const lower: number[][] = [], upper: number[][] = [];
  const running = ys.map(() => 0);
  cs.forEach((c) => {
    const lo: number[] = [], up: number[] = [];
    ys.forEach((y, yi) => { const b = running[yi]; const t = b + val(s, c, y); lo.push(b); up.push(t); running[yi] = t; });
    lower.push(lo); upper.push(up);
  });
  const bandW = ys.length === 1 ? X1 - X0 : (X1 - X0) / (ys.length - 1);
  const tipLines = (yi: number): TipLine[] =>
    cs.map((c, ci) => ({ label: c, value: fmt(val(s, c, ys[yi])), color: BANDS[ci % BANDS.length] })).filter((_, ci) => has(s, cs[ci], ys[yi]));
  return (
    <div className="chartwrap" ref={ref} onMouseLeave={() => { hide(); setHotYi(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
        {cs.map((c, ci) => {
          const top = ys.map((_, yi) => `${xOf(yi)},${yOf(upper[ci][yi])}`);
          const bot = ys.map((_, yi) => `${xOf(yi)},${yOf(lower[ci][yi])}`).reverse();
          return <polygon key={c} points={[...top, ...bot].join(" ")} fill={BANDS[ci % BANDS.length]} opacity={hotYi == null ? 0.82 : 0.7} />;
        })}
        {hotYi != null && <line className="chart-guide" x1={xOf(hotYi)} y1={Y0} x2={xOf(hotYi)} y2={Y1} />}
        {hotYi != null && cs.map((c, ci) => (has(s, c, ys[hotYi]) ? <circle key={c} cx={xOf(hotYi)} cy={yOf(upper[ci][hotYi])} r="3" fill={BANDS[ci % BANDS.length]} stroke="#fff" strokeWidth="1" /> : null))}
        {ys.map((y, yi) => (
          <rect
            key={y} className="hit" x={xOf(yi) - bandW / 2} y={Y0} width={bandW} height={Y1 - Y0} fill="transparent"
            onMouseMove={(e) => { show(e, String(y), tipLines(yi)); setHotYi(yi); }}
          />
        ))}
        {ys.map((y, yi) => (ys.length <= 5 || yi % 2 === 0 ? <text key={y} className="mx" x={xOf(yi)} y={H - 14} textAnchor="middle">{String(y).slice(2)}</text> : null))}
      </svg>
      <Legend labels={cs} />
      <TipBox tip={tip} />
    </div>
  );
}

/** One line per category; hover a year reveals every line's value at that year. */
export function MultiLineChart({ s, order }: { s: MacroSeries; order?: string[] }) {
  const { ref, tip, show, hide } = useTip();
  const [hotYi, setHotYi] = useState<number | null>(null);
  const cs = order ?? cats(s);
  const ys = yearsOf(s);
  if (!cs.length || !ys.length) return null;
  const all = s.points.map((p) => p.value);
  const vmax = Math.max(...all);
  const vmin = Math.min(0, ...all);
  const span = vmax - vmin || 1;
  const xOf = (i: number) => (ys.length === 1 ? (X0 + X1) / 2 : X0 + (i / (ys.length - 1)) * (X1 - X0));
  const yOf = (v: number) => Y1 - ((v - vmin) / span) * (Y1 - Y0);
  const bandW = ys.length === 1 ? X1 - X0 : (X1 - X0) / (ys.length - 1);
  const tipLines = (yi: number): TipLine[] =>
    cs.map((c, ci) => ({ label: c || s.series_label, value: fmt(val(s, c, ys[yi])), color: BANDS[ci % BANDS.length] })).filter((_, ci) => has(s, cs[ci], ys[yi]));
  return (
    <div className="chartwrap" ref={ref} onMouseLeave={() => { hide(); setHotYi(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
        <line className="scat-axis" x1={X0} y1={Y1} x2={X1} y2={Y1} />
        {hotYi != null && <line className="chart-guide" x1={xOf(hotYi)} y1={Y0} x2={xOf(hotYi)} y2={Y1} />}
        {cs.map((c, ci) => {
          const pts = ys.map((y, yi) => `${xOf(yi)},${yOf(val(s, c, y))}`).join(" ");
          return (
            <g key={c || "single"}>
              <polyline points={pts} fill="none" stroke={BANDS[ci % BANDS.length]} strokeWidth="2" opacity={hotYi == null ? 1 : 0.9} />
              {ys.map((y, yi) => <circle key={y} cx={xOf(yi)} cy={yOf(val(s, c, y))} r={hotYi === yi ? 4 : 2.6} fill={BANDS[ci % BANDS.length]} stroke="#fff" strokeWidth={hotYi === yi ? 1 : 0} />)}
            </g>
          );
        })}
        {ys.map((y, yi) => (
          <rect
            key={y} className="hit" x={xOf(yi) - bandW / 2} y={Y0} width={bandW} height={Y1 - Y0} fill="transparent"
            onMouseMove={(e) => { show(e, String(y), tipLines(yi)); setHotYi(yi); }}
          />
        ))}
        {ys.map((y, yi) => (ys.length <= 5 || yi % 2 === 0 ? <text key={y} className="mx" x={xOf(yi)} y={H - 14} textAnchor="middle">{String(y).slice(2)}</text> : null))}
        {cs.length >= 1 && (
          <>
            <text className="mv" x={xOf(0)} y={yOf(val(s, cs[0], ys[0])) - 6} textAnchor="middle">{fmt(val(s, cs[0], ys[0]))}</text>
            <text className="mv" x={xOf(ys.length - 1)} y={yOf(val(s, cs[0], ys[ys.length - 1])) - 6} textAnchor="middle">{fmt(val(s, cs[0], ys[ys.length - 1]))}</text>
          </>
        )}
      </svg>
      <Legend labels={cs.filter((c) => c !== "")} />
      <TipBox tip={tip} />
    </div>
  );
}

/** Multi-category stacked columns; percent100 normalises each year to 100. Hover per year. */
export function StackedColumns({ s, percent100, order }: { s: MacroSeries; percent100?: boolean; order?: string[] }) {
  const { ref, tip, show, hide } = useTip();
  const [hotYi, setHotYi] = useState<number | null>(null);
  const cs = order ?? cats(s);
  const ys = yearsOf(s);
  if (!cs.length || !ys.length) return null;
  const totals = ys.map((y) => cs.reduce((sum, c) => sum + Math.max(0, val(s, c, y)), 0));
  const vmax = percent100 ? 100 : Math.max(1e-9, ...totals);
  const step = (X1 - X0) / ys.length;
  const bw = Math.min(step * 0.6, 60);
  const tipLines = (yi: number): TipLine[] => {
    const denom = percent100 ? (totals[yi] || 1) : 1;
    return cs
      .map((c, ci) => ({ ci, c, raw: Math.max(0, val(s, c, ys[yi])) }))
      .filter((x) => has(s, x.c, ys[yi]))
      .map((x) => ({ label: x.c, value: percent100 ? `${((x.raw / denom) * 100).toFixed(1)}%` : fmt(x.raw), color: BANDS[x.ci % BANDS.length] }));
  };
  return (
    <div className="chartwrap" ref={ref} onMouseLeave={() => { hide(); setHotYi(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
        <line className="scat-axis" x1={X0} y1={Y1} x2={X1} y2={Y1} />
        {ys.map((y, yi) => {
          const cx = X0 + (yi + 0.5) * step;
          let acc = 0;
          const denom = percent100 ? (totals[yi] || 1) : vmax;
          const on = hotYi == null || hotYi === yi;
          return (
            <g key={y}>
              {cs.map((c, ci) => {
                const v = Math.max(0, val(s, c, y));
                const h = (v / denom) * (Y1 - Y0);
                const yTop = Y1 - acc - h;
                acc += h;
                return h > 0.5 ? <rect key={c} x={cx - bw / 2} y={yTop} width={bw} height={h} fill={BANDS[ci % BANDS.length]} opacity={on ? 0.88 : 0.4} /> : null;
              })}
              <rect
                className="hit" x={X0 + yi * step} y={Y0} width={step} height={Y1 - Y0} fill="transparent"
                onMouseMove={(e) => { show(e, String(y), tipLines(yi)); setHotYi(yi); }}
              />
              <text className="mx" x={cx} y={H - 14} textAnchor="middle">{String(y).slice(2)}</text>
              {!percent100 && <text className="mv" x={cx} y={Y1 - acc - 4} textAnchor="middle">{fmt(totals[yi])}</text>}
            </g>
          );
        })}
      </svg>
      <Legend labels={cs} />
      <TipBox tip={tip} />
    </div>
  );
}

/** Data table: categories as rows, years as columns. Row hover highlights via CSS. */
export function SeriesTable({ s, order, suffix = "" }: { s: MacroSeries; order?: string[]; suffix?: string }) {
  const cs = order ?? cats(s);
  const ys = yearsOf(s);
  if (!cs.length || !ys.length) return null;
  return (
    <table className="lt mt">
      <thead>
        <tr><th></th>{ys.map((y) => <th key={y} style={{ textAlign: "right" }}>{y}</th>)}</tr>
      </thead>
      <tbody>
        {cs.map((c) => (
          <tr key={c}>
            <td className="mt-cat">{c}</td>
            {ys.map((y) => {
              const v = val(s, c, y);
              return <td key={y} className="num">{v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v)}{suffix}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
