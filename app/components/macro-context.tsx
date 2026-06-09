import type { MacroSeries } from "@/lib/macro";

// Editorial band palette (claret, navy, gold, sage, plum, slate-teal).
const BANDS = ["#7a2230", "#1f3a5f", "#b07d2b", "#5b7c5a", "#8a5a78", "#3f6f7a"];
const W = 480, H = 240, L = 40, R = 12, T = 14, Bm = 30;
const X0 = L, X1 = W - R, Y0 = T, Y1 = H - Bm;

function ColumnChart({ s }: { s: MacroSeries }) {
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
            <text className="mv" x={cx} y={p.value >= 0 ? top - 3 : top + h + 9} textAnchor="middle">{p.value.toFixed(1)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StackedArea({ s }: { s: MacroSeries }) {
  const cats = Array.from(new Set(s.points.map((p) => p.category)));
  const years = Array.from(new Set(s.points.map((p) => p.year))).sort((a, b) => a - b);
  if (!cats.length || !years.length) return null;
  const val = (c: string, y: number) => s.points.find((p) => p.category === c && p.year === y)?.value ?? 0;
  const totals = years.map((y) => cats.reduce((sum, c) => sum + val(c, y), 0));
  const vmax = Math.max(1, ...totals);
  const xOf = (i: number) => (years.length === 1 ? X0 : X0 + (i / (years.length - 1)) * (X1 - X0));
  const yOf = (v: number) => Y1 - (v / vmax) * (Y1 - Y0);
  const lower: number[][] = [];
  const upper: number[][] = [];
  const running = years.map(() => 0);
  cats.forEach((c) => {
    const lo: number[] = [], up: number[] = [];
    years.forEach((y, yi) => { const b = running[yi]; const t = b + val(c, y); lo.push(b); up.push(t); running[yi] = t; });
    lower.push(lo); upper.push(up);
  });
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" role="img" aria-label={s.series_label}>
        {cats.map((c, ci) => {
          const top = years.map((_, yi) => `${xOf(yi)},${yOf(upper[ci][yi])}`);
          const bot = years.map((_, yi) => `${xOf(yi)},${yOf(lower[ci][yi])}`).reverse();
          return <polygon key={c} points={[...top, ...bot].join(" ")} fill={BANDS[ci % BANDS.length]} opacity="0.82" />;
        })}
        {years.map((y, yi) => (yi % 2 === 0 ? <text key={y} className="mx" x={xOf(yi)} y={H - 14} textAnchor="middle">{String(y).slice(2)}</text> : null))}
      </svg>
      <div className="macro-legend">
        {cats.map((c, ci) => (
          <span key={c}><i style={{ background: BANDS[ci % BANDS.length] }} />{c}</span>
        ))}
      </div>
    </>
  );
}

export function MacroContext({ series }: { series: MacroSeries[] }) {
  const result = series.find((s) => s.series_key === "result_before_tax");
  const gwp = series.find((s) => s.series_key === "gwp_by_line");
  if (!result && !gwp) return null;
  return (
    <section className="macro-sec">
      <h2 className="sec">Market context</h2>
      <p className="dek">Lloyd&apos;s market aggregates, 2016 to 2024. Context only: not syndicate-level, and not click-to-source.</p>
      <div className="macro-grid">
        {result && (
          <figure className="macro-card">
            <figcaption>{result.series_label} (&pound;bn)</figcaption>
            <ColumnChart s={result} />
          </figure>
        )}
        {gwp && (
          <figure className="macro-card">
            <figcaption>{gwp.series_label} (&pound;bn)</figcaption>
            <StackedArea s={gwp} />
          </figure>
        )}
      </div>
    </section>
  );
}
