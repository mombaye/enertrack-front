// src/features/fuel-tracking/ui.tsx
// Primitives visuelles partagées du module Suivi Carburant.

import type { CSSProperties, ReactNode } from "react";
import { FT, GROUP_PALETTE, toneColors, type Tone } from "./theme";

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
  const fg = tone === "gold" ? FT.gold : FT.navy;
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
        border: FT.borderCrisp,
        borderLeft: `3px solid ${c.fg}`,
        background: FT.card,
        borderRadius: FT.radius,
        padding: "13px 15px 14px",
        boxShadow: FT.shadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div
          style={{
            color: FT.textSub,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
        {icon && (
          <div style={{ width: 24, height: 24, borderRadius: 7, border: `1px solid ${c.fg}35`, color: c.fg, display: "grid", placeItems: "center", flexShrink: 0 }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ color: FT.text, fontSize: 21, fontWeight: 700, lineHeight: 1, letterSpacing: "-.01em", fontFamily: "ui-monospace, Menlo, monospace" }}>{value}</div>
      {sub && <div style={{ color: FT.textMid, fontSize: 11.5, marginTop: 7 }}>{sub}</div>}
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

/**
 * Barre de pastilles pour afficher/masquer des groupes de colonnes d'un
 * ExcelGrid — permet de réduire un tableau très large (beaucoup de groupes)
 * à seulement ceux qui intéressent l'utilisateur, sans perdre l'accès au reste.
 */
export function GroupToggleBar({
  groups,
  hidden,
  onToggle,
  onShowAll,
}: {
  groups: Array<{ id: string; label: string; color: keyof typeof GROUP_PALETTE }>;
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 850, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".07em", marginRight: 2 }}>
        Groupes de colonnes
      </span>
      {groups.map((g) => {
        const isHidden = hidden.has(g.id);
        const c = GROUP_PALETTE[g.color];
        return (
          <button
            key={g.id}
            onClick={() => onToggle(g.id)}
            title={isHidden ? `Afficher "${g.label}"` : `Masquer "${g.label}"`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${isHidden ? FT.border : c.fg}`,
              background: isHidden ? FT.slateL : c.bg,
              color: isHidden ? FT.textSub : c.fg,
              borderRadius: 999,
              padding: "5px 11px",
              fontSize: 11,
              fontWeight: 850,
              cursor: "pointer",
              opacity: isHidden ? 0.7 : 1,
              textDecoration: isHidden ? "line-through" : "none",
            }}
          >
            {g.label}
          </button>
        );
      })}
      {hidden.size > 0 && (
        <button
          onClick={onShowAll}
          style={{
            border: "none",
            background: "transparent",
            color: FT.blue,
            fontSize: 11,
            fontWeight: 850,
            cursor: "pointer",
            padding: "5px 6px",
          }}
        >
          Tout afficher
        </button>
      )}
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
