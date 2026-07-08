// src/features/fuel-tracking/ui.tsx
// Primitives visuelles partagées du module Suivi Carburant.

import type { CSSProperties, ReactNode } from "react";
import { FT, toneColors, type Tone } from "./theme";

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: CSSProperties;
  padded?: boolean;
}) {
  return (
    <div
      style={{
        background: FT.card,
        borderRadius: FT.radius,
        border: `1px solid ${FT.border}`,
        boxShadow: FT.shadow,
        padding: padded ? 20 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({ label, tone = "slate" }: { label: ReactNode; tone?: Tone }) {
  const c = toneColors(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11.5,
        fontWeight: 800,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}

export function ComingCell() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10.5,
        fontWeight: 700,
        color: FT.textSub,
        border: `1px dashed ${FT.borderStrong}`,
        borderRadius: 999,
        padding: "2px 8px",
        background: FT.cardAlt,
      }}
    >
      à venir
    </span>
  );
}

export function Skeleton({ h }: { h: number }) {
  return <div className="ft-skel" style={{ height: h, borderRadius: 12 }} />;
}

export function SheetTitle({
  icon,
  title,
  subtitle,
  tone = "navy",
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  tone?: "navy" | "gold";
}) {
  const bg = tone === "gold" ? FT.goldL : FT.blueL;
  const fg = tone === "gold" ? "#9A5B10" : FT.navy;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: bg,
          display: "grid",
          placeItems: "center",
          color: fg,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: FT.text, letterSpacing: "-.01em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: FT.textSub, marginTop: 3 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  tone = "slate",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
  icon?: ReactNode;
}) {
  const c = toneColors(tone);
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${FT.border}`,
        background: FT.card,
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: FT.shadow,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c.fg, opacity: 0.85 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div
          style={{
            color: FT.textSub,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".07em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        {icon && (
          <div style={{ width: 26, height: 26, borderRadius: 8, background: c.bg, color: c.fg, display: "grid", placeItems: "center" }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ color: FT.text, fontSize: 23, fontWeight: 900, lineHeight: 1, letterSpacing: "-.01em" }}>{value}</div>
      {sub && <div style={{ color: FT.textMid, fontSize: 11.5, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 3,
        padding: 4,
        borderRadius: 12,
        background: "rgba(255,255,255,.08)",
        border: "1px solid rgba(255,255,255,.14)",
        flexWrap: "wrap",
      }}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 9,
              border: "none",
              background: active ? "#FFFFFF" : "transparent",
              color: active ? FT.navy : FT.textOnDarkSub,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: "pointer",
              transition: "all .15s ease",
              whiteSpace: "nowrap",
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "48px 20px",
        color: FT.textSub,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: FT.slateL,
          display: "grid",
          placeItems: "center",
          color: FT.textSub,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: FT.textMid }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, textAlign: "center", maxWidth: 320 }}>{subtitle}</div>}
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
      <span style={{ fontSize: 12, color: FT.textSub, fontWeight: 700 }}>
        Page {page} / {totalPages}
      </span>
      <button disabled={!hasPrev} onClick={onPrev} style={pagerBtn(!hasPrev)}>
        ‹ Précédent
      </button>
      <button disabled={!hasNext} onClick={onNext} style={pagerBtn(!hasNext)}>
        Suivant ›
      </button>
    </div>
  );
}

function pagerBtn(disabled: boolean): CSSProperties {
  return {
    padding: "8px 13px",
    borderRadius: 9,
    border: `1px solid ${FT.border}`,
    background: disabled ? FT.slateL : FT.card,
    color: disabled ? FT.textSub : FT.text,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 800,
  };
}

export const GLOBAL_STYLES = `
  .fuelbook, .fuelbook * {
    box-sizing: border-box;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  }
  @keyframes ftFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ftSpin { to { transform: rotate(360deg); } }
  @keyframes ftShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .ft-fade { animation: ftFadeUp .25s ease-out both; }
  .ft-skel { background: linear-gradient(90deg, #EEF2F7 25%, #E2E9F2 50%, #EEF2F7 75%); background-size: 200% 100%; animation: ftShimmer 1.2s infinite; }
  .ft-spin { animation: ftSpin .75s linear infinite; }
  .fuelbook input, .fuelbook select, .fuelbook button { font-family: inherit; }
  .ft-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
  .ft-scroll::-webkit-scrollbar-track { background: #F1F5F9; }
  .ft-scroll::-webkit-scrollbar-thumb { background: #C7D2E0; border-radius: 999px; border: 2px solid #F1F5F9; }
  .ft-scroll::-webkit-scrollbar-thumb:hover { background: #A8B7CC; }
  .ft-row:hover td { background: #F5F8FF !important; }
`;
