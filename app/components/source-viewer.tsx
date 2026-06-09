"use client";

import { useEffect, useRef, useState } from "react";

export type SourceTarget = {
  syndicate_number: number;
  page: number;
  name: string;
  year: number;
  label: string; // e.g. "Gross written premium"
  value: string; // e.g. "£1,748.7m"
};

// Modal that opens the actual source report page (rendered to PNG at build time,
// served from /public/sources) with the cited figure highlighted. Closes on Escape
// or backdrop click. Degrades to a message if the page image is missing.
export function SourceViewer({ target, onClose }: { target: SourceTarget | null; onClose: () => void }) {
  const [imgError, setImgError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgError(false); // reset when the target changes
    if (!target) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      panelRef.current?.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])") ?? [];
    focusables()[0]?.focus(); // move focus into the dialog (the close button)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        // Minimal focus trap: cycle within the dialog.
        const els = Array.from(focusables());
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [target, onClose]);

  if (!target) return null;
  const valid = Number.isInteger(target.syndicate_number) && Number.isInteger(target.page);
  const src = `/sources/${target.syndicate_number}/p${target.page}.png`;

  return (
    <div
      className="sv-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Source page for ${target.name}`}
      onClick={onClose}
    >
      <div className="sv-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="sv-head">
          <div>
            <div className="sv-title">{target.name} · Syndicate {target.syndicate_number} · Annual Report {target.year}</div>
            <div className="sv-sub">{target.label} <b>{target.value}</b> · page {target.page}</div>
          </div>
          <button className="sv-close" onClick={onClose} aria-label="Close source viewer">×</button>
        </div>
        <div className="sv-body">
          {valid && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`${target.name} annual report page ${target.page}, ${target.label} highlighted`}
              onError={() => setImgError(true)}
            />
          ) : (
            <p className="sv-missing">Source page image is not available for this figure yet. The citation (page {target.page}) is verified against the filing.</p>
          )}
        </div>
        <div className="sv-foot">Source: Lloyd&apos;s syndicate annual report. The cited figure is highlighted in gold.</div>
      </div>
    </div>
  );
}
