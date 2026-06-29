---
name: Ask the Market — Modern Light Fintech
version: 2.0
tokens:
  color:
    bg: "#f6f7f9"          # app background, cool off-white
    panel: "#ffffff"        # card surface
    ink: "#0f172a"          # primary text (slate-900)
    ink2: "#1e293b"         # secondary text
    muted: "#64748b"        # slate-500
    faint: "#94a3b8"        # slate-400
    line: "#e7eaee"         # hairline border
    line2: "#eef1f4"        # inner divider
    brand: "#2563eb"        # primary (blue-600)
    brandDark: "#1d4ed8"
    brandSoft: "#eff4ff"    # tinted background
    positive: "#059669"     # gains
    negative: "#dc2626"     # losses
    amber: "#d97706"        # provenance / context accent
  font:
    sans: "Plus Jakarta Sans"   # geometric grotesk, via next/font (no Inter/Roboto/Arial)
    mono: "ui-monospace, JetBrains Mono, SF Mono, Consolas"
  radius:
    card: "14px"
    control: "10px"
    pill: "999px"
  shadow:
    card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)"
    raised: "0 4px 14px rgba(16,24,40,.08)"
  space:
    page_max: "1180px"
---

# Ask the Market — design system v2

A modern, light **fintech** aesthetic for a trust-driven Lloyd's insurance data product.
Clean white surfaces, soft shadows, rounded cards, a geometric grotesk, and one confident
blue accent. Numbers are the hero, so financial values use tabular figures; gains are
emerald, losses are red, provenance/context is amber.

## Principles
- **Cards, not rules.** Surfaces float on a cool off-white background with hairline borders
  and a soft shadow. No heavy newspaper rules.
- **One accent.** Blue `#2563eb` for interaction and emphasis; green/red only for deltas;
  amber only for "context / extracted" provenance. Restraint reads as credible.
- **Grotesk everything.** Plus Jakarta Sans across UI and headings (self-hosted via
  next/font for zero layout shift). No serif, no Inter/Roboto/Arial, no purple gradients.
- **Global nav.** A sticky top bar unifies the three sections (Research desk · Syndicates ·
  Market) now that the data spans 132 syndicates + market intelligence.
- **Same class system.** Re-skin is CSS-led against the existing class names, so behaviour
  and accessibility (Lighthouse 100/96/100/100) are preserved.

## Components
- **KPI tiles** → rounded white cards in a gapped grid (was a bordered strip).
- **Ask box / search** → rounded card input, filled blue action button, focus ring.
- **Segmented toggles** → pill segmented control, active = blue.
- **Tables** → uppercase micro headers, hairline row dividers, slate hover, tabular mono numerics.
- **Charts** → categorical palette (blue, cyan, violet, emerald, amber, pink, slate); each chart sits in a card.
