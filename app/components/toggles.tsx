"use client";

import { useRouter, useSearchParams } from "next/navigation";

const CCY = ["GBP", "USD", "EUR"] as const;
const YEARS = [2022, 2023] as const;

// Currency + year-of-account toggles. They write URL search params; the server component
// re-renders with real data for the selected year and re-bases monetary displays.
export function Toggles({ ccy, year }: { ccy: string; year: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  const go = (key: string, val: string) => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set(key, val);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="toggles">
      <div className="seg" role="group" aria-label="Display currency">
        {CCY.map((c) => (
          <button key={c} type="button" className={c === ccy ? "on" : ""} aria-pressed={c === ccy} onClick={() => go("ccy", c)}>{c}</button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Year of account">
        {YEARS.map((y) => (
          <button key={y} type="button" className={y === year ? "on" : ""} aria-pressed={y === year} onClick={() => go("year", String(y))}>{y}</button>
        ))}
      </div>
    </div>
  );
}
