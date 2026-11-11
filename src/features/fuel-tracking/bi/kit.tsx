// src/features/fuel-tracking/bi/kit.tsx
// Briques « BI » du Suivi carburant (KPI avec variation, cartes graphiques, Top 10, filtres),
// aux couleurs Camusat (navy #0B1F4D / bleu #1A56C4, voir theme.ts). Une valeur absente
// s'affiche « — », jamais 0.

import { useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronDown, Minus } from "lucide-react";
import { FT, toneColors, type Tone } from "../theme";
import { Card, Skeleton } from "../ui";

// Palette des graphiques — identité Camusat ; le rouge/orange gardés pour les alertes.
export const BI = {
  primary: FT.navy,
  secondary: FT.gold, // #1A56C4 — bleu Camusat
  light: "#9DBBEA",
  enoc: FT.orange,
  ok: FT.green,
  warn: FT.orange,
  bad: FT.red,
  unknown: "#B6C0CF",
  grid: "#E8EDF4",
  axis: FT.textSub,
  band: "#E7F9F1",
} as const;

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fNum = (v: number | null | undefined) => (v == null ? "—" : nf0.format(v));
export const fL = (v: number | null | undefined) => (v == null ? "—" : `${nf0.format(v)} L`);
export const fPct = (v: number | null | undefined) => (v == null ? "—" : `${nf1.format(v)} %`);
export const fRatio = (v: number | null | undefined) => (v == null ? "—" : nf2.format(v));
export const fShort = (v: number) => (Math.abs(v) >= 1_000_000 ? `${nf1.format(v / 1_000_000)} M` : Math.abs(v) >= 1000 ? `${nf0.format(v / 1000)} k` : nf0.format(v));

export const axisProps = { tick: { fill: BI.axis, fontSize: 11 }, axisLine: false, tickLine: false } as const;
export const tooltipStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${FT.border}`, fontSize: 12, boxShadow: FT.shadowLg };

/** KPI avec variation vs période précédente. `upIsGood` décide de la couleur de la variation. */
export function BiKpi({ label, value, delta, deltaUnit = "%", upIsGood = true, sub, tone = "blue", icon }: {
  label: string; value: string; delta?: number | null; deltaUnit?: "%" | "pts"; upIsGood?: boolean;
  sub?: ReactNode; tone?: Tone; icon?: ReactNode;
}) {
  const c = toneColors(tone);
  const hasDelta = delta != null;
  const good = hasDelta && (delta === 0 ? null : (delta > 0) === upIsGood);
  const color = !hasDelta || delta === 0 ? FT.textSub : good ? FT.green : FT.red;
  const Arrow = !hasDelta || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div style={{ border: FT.borderCrisp, borderLeft: `3px solid ${c.fg}`, background: FT.card, borderRadius: FT.radius, padding: "13px 15px 14px", boxShadow: FT.shadow, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9, gap: 8 }}>
        <div style={{ color: FT.textSub, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", lineHeight: 1.3 }}>{label}</div>
        {icon && <div style={{ width: 24, height: 24, borderRadius: 7, border: `1px solid ${c.fg}35`, color: c.fg, display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</div>}
      </div>
      <div style={{ color: FT.text, fontSize: 22, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.01em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: 11.5, color: FT.textMid, flexWrap: "wrap" }}>
        {hasDelta && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color, fontWeight: 800 }}>
            <Arrow size={13} aria-hidden />
            {delta > 0 ? "+" : ""}{nf1.format(delta)} {deltaUnit}
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>{children}</div>;
}

export function Grid({ min = 380, children }: { min?: number; children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 14 }}>{children}</div>;
}

/** Carte de graphique : titre + sous-titre + états chargement / erreur / vide. */
export function ChartCard({ title, subtitle, legend, loading, error, empty, height = 260, children, action }: {
  title: string; subtitle?: string; legend?: Array<{ label: string; color: string; dashed?: boolean }>;
  loading?: boolean; error?: boolean; empty?: boolean; height?: number; children: ReactNode; action?: ReactNode;
}) {
  return (
    <Card style={{ padding: "16px 18px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: FT.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {legend && legend.length > 0 && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 11.5, color: FT.textMid }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: l.dashed ? 0 : 10, borderRadius: 2, background: l.dashed ? "transparent" : l.color, borderTop: l.dashed ? `2px dashed ${l.color}` : undefined }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        {loading ? <Skeleton h={height} />
          : error ? <StateBox height={height} tone="red" text="Données indisponibles (erreur de chargement)." />
          : empty ? <StateBox height={height} text="Aucune donnée sur la période et les filtres choisis." />
          : <div style={{ height, minWidth: 0 }}>{children}</div>}
      </div>
    </Card>
  );
}

export function StateBox({ height, text, tone = "slate" }: { height: number; text: string; tone?: Tone }) {
  const c = toneColors(tone);
  return (
    <div role="status" style={{ height, display: "grid", placeItems: "center", background: c.bg, border: `1px dashed ${c.bd}`, borderRadius: FT.radiusSm, color: c.fg, fontSize: 12.5, fontWeight: 600, textAlign: "center", padding: 12 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{tone === "red" && <AlertTriangle size={14} aria-hidden />}{text}</span>
    </div>
  );
}

export type TopColumn<T> = { label: string; render: (row: T) => ReactNode; align?: "left" | "right"; width?: string };

/** Tableau Top N avec rang et barre de magnitude sur la colonne `barValue`. */
export function TopTable<T>({ title, subtitle, rows, columns, barValue, barColor = BI.secondary, loading, error, onRowClick }: {
  title: string; subtitle?: string; rows: T[] | undefined; columns: TopColumn<T>[];
  barValue?: (row: T) => number | null; barColor?: string | ((row: T) => string);
  loading?: boolean; error?: boolean; onRowClick?: (row: T) => void;
}) {
  const max = Math.max(1, ...(rows ?? []).map((r) => Math.abs(barValue?.(r) ?? 0)));
  return (
    <Card style={{ padding: "16px 18px", minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: FT.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 2 }}>{subtitle}</div>}
      <div style={{ marginTop: 10, overflowX: "auto" }}>
        {loading ? <Skeleton h={260} />
          : error ? <StateBox height={160} tone="red" text="Données indisponibles (erreur de chargement)." />
          : !rows?.length ? <StateBox height={160} text="Aucun site sur la période et les filtres choisis." />
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th scope="col" style={th("left", "28px")}>#</th>
                  {columns.map((c) => <th scope="col" key={c.label} style={th(c.align ?? "left", c.width)}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const bv = barValue?.(r);
                  const color = typeof barColor === "function" ? barColor(r) : barColor;
                  return (
                    <tr key={i} onClick={onRowClick ? () => onRowClick(r) : undefined} style={{ cursor: onRowClick ? "pointer" : undefined }}>
                      <td style={{ ...td("left"), color: FT.textSub, fontWeight: 700 }}>{i + 1}</td>
                      {columns.map((c, ci) => (
                        <td key={c.label} style={td(c.align ?? "left")}>
                          {c.render(r)}
                          {ci === 0 && bv != null && (
                            <div aria-hidden style={{ height: 4, borderRadius: 2, background: FT.slateL, marginTop: 4 }}>
                              <div style={{ width: `${(Math.abs(bv) / max) * 100}%`, height: 4, borderRadius: 2, background: color }} />
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
    </Card>
  );
}

const th = (align: "left" | "right", width?: string): CSSProperties => ({
  textAlign: align, padding: "6px 6px", fontSize: 10.5, fontWeight: 700, color: FT.textSub, textTransform: "uppercase",
  letterSpacing: ".05em", borderBottom: `1px solid ${FT.border}`, width, whiteSpace: "nowrap",
});
const td = (align: "left" | "right"): CSSProperties => ({
  textAlign: align, padding: "7px 6px", borderBottom: `1px solid ${FT.border}`, color: FT.text,
  fontVariantNumeric: "tabular-nums", verticalAlign: "top",
});

export function SiteCell({ id, name }: { id: string; name?: string | null }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 700, color: FT.navy }}>{id}</div>
      {name && name !== id && <div style={{ fontSize: 11, color: FT.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{name}</div>}
    </div>
  );
}

/** Filtres « segments » façon Power BI. */
export function FilterBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: FT.card, border: FT.borderCrisp, borderRadius: FT.radius, padding: "9px 14px", boxShadow: FT.shadow }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: FT.textSub, letterSpacing: ".06em", textTransform: "uppercase" }}>Filtres</span>
      {children}
      {note && <span style={{ marginLeft: "auto", fontSize: 11.5, color: FT.textSub }}>{note}</span>}
    </div>
  );
}

export function FilterSelect({ label, value, options, onChange, allLabel = "Tous" }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; allLabel?: string;
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: FT.textMid }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 8, padding: "5px 8px", fontSize: 12.5, fontWeight: 700, color: FT.text }}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: FT.navy, letterSpacing: ".07em", textTransform: "uppercase" }}>{children}</div>
      {sub && <div style={{ fontSize: 11.5, color: FT.textSub }}>{sub}</div>}
    </div>
  );
}

/** Bloc repliable pour garder les tableaux opérationnels existants sous la vue BI.
 * Contenu monté seulement une fois ouvert (pas de requêtes lourdes tant qu'il est fermé). */
export function DetailSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{ background: FT.card, border: FT.borderCrisp, borderRadius: FT.radius, boxShadow: FT.shadow }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, color: FT.navy, textAlign: "left" }}>
        <ChevronDown size={16} aria-hidden style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }} />
        {title}
      </button>
      {open && <div style={{ padding: "4px 14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>}
    </section>
  );
}
