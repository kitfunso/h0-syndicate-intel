import type { MacroSeries } from "@/lib/macro";

/**
 * Editorial SVG chart primitives for the MACRO (market-context) layer. Server
 * components, no client JS. All render from market_series rows and are labelled
 * context: macro data is never wired to the source-page viewer.
 */

export const BANDS = ["#7a2230", "#1f3a5f", "#b07d2b", "#5b7c5a", "#8a5a78", "#3f6f7a", "#9a6a4f"];
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

/** Single-series vertical columns (positive navy, negative claret). */
export function ColumnChart({ s }: { s: MacroSeries }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
      <line className="scat-axis" x1={X0} y1={zeroY} x2={X1} y2={zeroY} />
      {pts.map((p, i) => {
        const cx = X0 + (i + 0.5) * step;
        const y = yOf(p.value);
        const top = Math.min(y, zeroY);
        const h = Math.max(1, Math.abs(y - zeroY));
        return (
          <g key={p.year}>
            <rect x={cx - bw / 2} y={top} width={bw} height={h} fill={p.value >= 0 ? "#1f3a5f" : "#7a2230"} opacity="0.9" />
            <text className="mx" x={cx} y={H - 14} textAnchor="middle">{String(p.year).slice(2)}</text>
            <text className="mv" x={cx} y={p.value >= 0 ? top - 3 : top + h + 9} textAnchor="middle">{fmt(p.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Multi-category stacked area over a continuous year range. */
export function StackedAreaChart({ s }: { s: MacroSeries }) {
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
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
        {cs.map((c, ci) => {
          const top = ys.map((_, yi) => `${xOf(yi)},${yOf(upper[ci][yi])}`);
          const bot = ys.map((_, yi) => `${xOf(yi)},${yOf(lower[ci][yi])}`).reverse();
          return <polygon key={c} points={[...top, ...bot].join(" ")} fill={BANDS[ci % BANDS.length]} opacity="0.82" />;
        })}
        {ys.map((y, yi) => (ys.length <= 5 || yi % 2 === 0 ? <text key={y} className="mx" x={xOf(yi)} y={H - 14} textAnchor="middle">{String(y).slice(2)}</text> : null))}
      </svg>
      <Legend labels={cs} />
    </>
  );
}

/** One line per category (single '' category = one line). */
export function MultiLineChart({ s, order }: { s: MacroSeries; order?: string[] }) {
  const cs = order ?? cats(s);
  const ys = yearsOf(s);
  if (!cs.length || !ys.length) return null;
  const all = s.points.map((p) => p.value);
  const vmax = Math.max(...all);
  const vmin = Math.min(0, ...all);
  const span = vmax - vmin || 1;
  const xOf = (i: number) => (ys.length === 1 ? (X0 + X1) / 2 : X0 + (i / (ys.length - 1)) * (X1 - X0));
  const yOf = (v: number) => Y1 - ((v - vmin) / span) * (Y1 - Y0);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
        <line className="scat-axis" x1={X0} y1={Y1} x2={X1} y2={Y1} />
        {cs.map((c, ci) => {
          const pts = ys.map((y, yi) => `${xOf(yi)},${yOf(val(s, c, y))}`).join(" ");
          return (
            <g key={c || "single"}>
              <polyline points={pts} fill="none" stroke={BANDS[ci % BANDS.length]} strokeWidth="2" />
              {ys.map((y, yi) => <circle key={y} cx={xOf(yi)} cy={yOf(val(s, c, y))} r="2.6" fill={BANDS[ci % BANDS.length]} />)}
            </g>
          );
        })}
        {ys.map((y, yi) => (ys.length <= 5 || yi % 2 === 0 ? <text key={y} className="mx" x={xOf(yi)} y={H - 14} textAnchor="middle">{String(y).slice(2)}</text> : null))}
        {/* first/last value annotations for the first category */}
        {cs.length >= 1 && (
          <>
            <text className="mv" x={xOf(0)} y={yOf(val(s, cs[0], ys[0])) - 6} textAnchor="middle">{fmt(val(s, cs[0], ys[0]))}</text>
            <text className="mv" x={xOf(ys.length - 1)} y={yOf(val(s, cs[0], ys[ys.length - 1])) - 6} textAnchor="middle">{fmt(val(s, cs[0], ys[ys.length - 1]))}</text>
          </>
        )}
      </svg>
      <Legend labels={cs.filter((c) => c !== "")} />
    </>
  );
}

/** Multi-category stacked columns; percent100 normalises each year to 100. */
export function StackedColumns({ s, percent100, order }: { s: MacroSeries; percent100?: boolean; order?: string[] }) {
  const cs = order ?? cats(s);
  const ys = yearsOf(s);
  if (!cs.length || !ys.length) return null;
  const totals = ys.map((y) => cs.reduce((sum, c) => sum + Math.max(0, val(s, c, y)), 0));
  const vmax = percent100 ? 100 : Math.max(1e-9, ...totals);
  const step = (X1 - X0) / ys.length;
  const bw = Math.min(step * 0.6, 60);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
        <line className="scat-axis" x1={X0} y1={Y1} x2={X1} y2={Y1} />
        {ys.map((y, yi) => {
          const cx = X0 + (yi + 0.5) * step;
          let acc = 0;
          const denom = percent100 ? (totals[yi] || 1) : vmax;
          return (
            <g key={y}>
              {cs.map((c, ci) => {
                const v = Math.max(0, val(s, c, y));
                const h = (v / denom) * (Y1 - Y0);
                const yTop = Y1 - acc - h;
                acc += h;
                return h > 0.5 ? <rect key={c} x={cx - bw / 2} y={yTop} width={bw} height={h} fill={BANDS[ci % BANDS.length]} opacity="0.88" /> : null;
              })}
              <text className="mx" x={cx} y={H - 14} textAnchor="middle">{String(y).slice(2)}</text>
              {!percent100 && <text className="mv" x={cx} y={Y1 - acc - 4} textAnchor="middle">{fmt(totals[yi])}</text>}
            </g>
          );
        })}
      </svg>
      <Legend labels={cs} />
    </>
  );
}

/** Editorial data table: categories as rows, years as columns. */
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
