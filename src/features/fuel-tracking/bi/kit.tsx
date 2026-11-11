// src/features/fuel-tracking/bi/kit.tsx
// Briques « BI » du Suivi carburant : bandeau d'indicateurs, cartes graphiques, tableaux classés
// avec barres de données, filtres et export Excel. Couleurs Camusat (navy #0B1F4D / bleu #1A56C4,
// voir theme.ts). Une valeur absente s'affiche « — », jamais 0.

import { Children, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Download, Info } from "lucide-react";
import { FT, toneColors, type Tone } from "../theme";
import { Card, Skeleton } from "../ui";

// Palette des graphiques — deux bleus Camusat ; rouge/orange réservés aux alertes.
export const BI = {
  primary: FT.navy,
  secondary: FT.gold, // #1A56C4 — bleu Camusat
  light: "#9DBBEA",
  enoc: FT.orange,
  ok: FT.green,
  warn: FT.orange,
  bad: FT.red,
  unknown: "#C9D1DD",
  grid: "#EDF1F6",
  axis: "#7A8699",
  band: "#E7F9F1",
} as const;

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fNum = (v: number | null | undefined) => (v == null ? "—" : nf0.format(v));
export const fL = (v: number | null | undefined) => (v == null ? "—" : `${nf0.format(v)} L`);
export const fPct = (v: number | null | undefined) => (v == null ? "—" : `${nf1.format(v)} %`);
export const fSignedPct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${nf1.format(v)} %`);
export const fDays = (v: number | null | undefined) => (v == null ? "—" : `${nf1.format(v)} j`);
export const fRatio = (v: number | null | undefined) => (v == null ? "—" : nf2.format(v));
export const fDec1 = (v: number | null | undefined) => (v == null ? "—" : nf1.format(v));
export const fShort = (v: number) => (Math.abs(v) >= 1_000_000 ? `${nf1.format(v / 1_000_000)} M` : Math.abs(v) >= 1000 ? `${nf0.format(v / 1000)} k` : nf0.format(v));
/** Libellé de barre (LabelList) : rien si absent. */
export const fLabel = (v: unknown) => (typeof v === "number" ? fShort(v).replace(" ", "\u00a0") : "");

export const axisProps = { tick: { fill: BI.axis, fontSize: 11 }, axisLine: false, tickLine: false } as const;
export const tooltipStyle: CSSProperties = { borderRadius: 4, border: `1px solid #D9DEE7`, fontSize: 12, boxShadow: "0 2px 8px rgba(11,31,77,.12)" };
export const labelStyle = { fill: FT.textMid, fontSize: 10.5 } as const;

/**
 * Bandeau d'indicateurs : une seule carte découpée en cellules (style tableau de bord Power BI).
 * Enfants attendus : des <BiKpi/>.
 */
export function KpiRow({ children }: { children: ReactNode }) {
  const n = Children.count(children);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(170px, 100%), 1fr))`,
      background: FT.card, border: FT.borderCrisp, borderRadius: 6, overflow: "hidden",
    }} data-kpis={n}>
      {children}
    </div>
  );
}

/**
 * Indicateur : libellé, valeur, puis une ligne de contexte (variation vs période précédente et/ou précision).
 * `upIsGood` décide de la couleur de la variation ; `alert` colore la valeur quand elle sort de la norme.
 */
export function BiKpi({ label, value, unit, delta, deltaUnit = "%", upIsGood = true, sub, alert, hint }: {
  label: string; value: string; unit?: string; delta?: number | null; deltaUnit?: "%" | "pts"; upIsGood?: boolean;
  sub?: ReactNode; alert?: "bad" | "warn" | null; hint?: string;
}) {
  const hasDelta = delta != null;
  const color = !hasDelta || delta === 0 ? FT.textMid : (delta > 0) === upIsGood ? FT.green : FT.red;
  return (
    <div style={{ background: FT.card, padding: "12px 16px 13px", minWidth: 0, boxShadow: "1px 0 0 #E4E9F0, 0 1px 0 #E4E9F0" }} title={hint}>
      <div style={{ color: FT.textMid, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 6 }}>
        <span style={{ color: alert === "bad" ? FT.red : alert === "warn" ? FT.orange : FT.navy, fontSize: 24, fontWeight: 700, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {unit && value !== "—" && <span style={{ color: FT.textMid, fontSize: 12.5, fontWeight: 600 }}>{unit}</span>}
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: FT.textSub, lineHeight: 1.35 }}>
        {hasDelta && (
          <span style={{ color, fontWeight: 700, marginRight: 6, whiteSpace: "nowrap" }}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {delta > 0 ? "+" : ""}{nf1.format(delta)} {deltaUnit === "pts" ? "pt" : "%"}
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

export function Grid({ min = 380, children }: { min?: number; children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 12 }}>{children}</div>;
}

/** Petit « i » dont le survol donne la méthode de calcul (au lieu d'un sous-titre explicatif permanent). */
export function InfoTip({ text }: { text: string }) {
  return (
    <span title={text} aria-label={text} role="img" style={{ display: "inline-flex", color: FT.textSub, cursor: "help", verticalAlign: "-2px" }}>
      <Info size={13} aria-hidden />
    </span>
  );
}

/** Carte de graphique : titre court + méthode en infobulle + états chargement / erreur / vide. */
export function ChartCard({ title, info, legend, loading, error, empty, height = 250, children, action }: {
  title: string; info?: string; legend?: Array<{ label: string; color: string; dashed?: boolean }>;
  loading?: boolean; error?: boolean; empty?: boolean; height?: number; children: ReactNode; action?: ReactNode;
}) {
  return (
    <Card style={{ padding: "14px 16px", minWidth: 0, borderRadius: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: FT.text, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {title}{info && <InfoTip text={info} />}
        </div>
        {action}
      </div>
      {legend && legend.length > 0 && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 11.5, color: FT.textMid }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: l.dashed ? 0 : 10, background: l.dashed ? "transparent" : l.color, borderTop: l.dashed ? `2px dashed ${l.color}` : undefined }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
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
    <div role="status" style={{ height, display: "grid", placeItems: "center", background: tone === "slate" ? FT.slateL : c.bg, borderRadius: 4, color: tone === "slate" ? FT.textMid : c.fg, fontSize: 12.5, textAlign: "center", padding: 12 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{tone === "red" && <AlertTriangle size={14} aria-hidden />}{text}</span>
    </div>
  );
}

export type TopColumn<T> = { label: string; render: (row: T) => ReactNode; align?: "left" | "right"; width?: string };

/**
 * Tableau classé (Top N). `barColumn` reçoit une barre de données en fond de cellule, comme dans Power BI,
 * proportionnelle à `barValue` (échelle `barMax`, sinon le maximum du tableau).
 */
export function TopTable<T>({ title, info, rows, columns, barValue, barMax, barColor = BI.light, barColumn = 1, loading, error, onRowClick }: {
  title: string; info?: string; rows: T[] | undefined; columns: TopColumn<T>[];
  barValue?: (row: T) => number | null; barMax?: number; barColor?: string | ((row: T) => string); barColumn?: number;
  loading?: boolean; error?: boolean; onRowClick?: (row: T) => void;
}) {
  const max = barMax ?? Math.max(1, ...(rows ?? []).map((r) => Math.abs(barValue?.(r) ?? 0)));
  return (
    <Card style={{ padding: "14px 16px", minWidth: 0, borderRadius: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: FT.text, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {title}{info && <InfoTip text={info} />}
      </div>
      <div style={{ marginTop: 8, overflowX: "auto" }}>
        {loading ? <Skeleton h={260} />
          : error ? <StateBox height={160} tone="red" text="Données indisponibles (erreur de chargement)." />
          : !rows?.length ? <StateBox height={160} text="Aucun site sur la période et les filtres choisis." />
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>{columns.map((c) => <th scope="col" key={c.label} style={th(c.align ?? "left", c.width)}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const bv = barValue?.(r);
                  const color = typeof barColor === "function" ? barColor(r) : barColor;
                  const pct = bv == null ? 0 : Math.max(0, Math.min(100, (Math.abs(bv) / max) * 100));
                  return (
                    <tr key={i} onClick={onRowClick ? () => onRowClick(r) : undefined}
                      style={{ cursor: onRowClick ? "pointer" : undefined, background: i % 2 ? "#FAFBFD" : undefined }}>
                      {columns.map((c, ci) => (
                        <td key={c.label} style={{
                          ...td(c.align ?? "left"),
                          ...(ci === barColumn && bv != null ? {
                            backgroundImage: `linear-gradient(to ${c.align === "right" ? "left" : "right"}, ${color}55 ${pct}%, transparent ${pct}%)`,
                            backgroundClip: "content-box",
                          } : null),
                        }}>{c.render(r)}</td>
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
  textAlign: align, padding: "6px 8px", fontSize: 11.5, fontWeight: 600, color: FT.textMid,
  borderBottom: `2px solid ${FT.navy}`, width, whiteSpace: "nowrap",
});
const td = (align: "left" | "right"): CSSProperties => ({
  textAlign: align, padding: "6px 8px", borderBottom: `1px solid #EEF1F5`, color: FT.text,
  fontVariantNumeric: "tabular-nums", verticalAlign: "middle", whiteSpace: align === "right" ? "nowrap" : undefined,
});

export function SiteCell({ id, name }: { id: string; name?: string | null }) {
  return (
    <div style={{ minWidth: 0, lineHeight: 1.25 }}>
      <span style={{ fontWeight: 600, color: FT.navy }}>{id}</span>
      {name && name !== id && <div style={{ fontSize: 11, color: FT.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 210 }}>{name}</div>}
    </div>
  );
}

/** Bouton d'export Excel (classeur complet généré côté serveur). */
export function ExportButton({ onExport, label = "Exporter Excel" }: { onExport: () => Promise<void>; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {err && <span role="alert" style={{ fontSize: 11.5, color: FT.red }}>Export impossible, réessayez.</span>}
      <button type="button" disabled={busy}
        onClick={async () => { setBusy(true); setErr(false); try { await onExport(); } catch { setErr(true); } finally { setBusy(false); } }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${FT.navy}`, background: busy ? FT.slateL : FT.card,
          color: FT.navy, borderRadius: 4, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "wait" : "pointer",
        }}>
        <Download size={14} aria-hidden />{busy ? "Préparation…" : label}
      </button>
    </span>
  );
}

/** Barre de filtres (segments) + export. */
export function FilterBar({ children, note, onExport }: { children?: ReactNode; note?: ReactNode; onExport?: () => Promise<void> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "2px 0" }}>
      {children}
      {note && <span style={{ fontSize: 12, color: FT.textMid }}>{note}</span>}
      {onExport && <span style={{ marginLeft: "auto" }}><ExportButton onExport={onExport} /></span>}
    </div>
  );
}

export function FilterSelect({ label, value, options, onChange, allLabel = "Tous" }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; allLabel?: string;
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: FT.textMid }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: `1px solid #CBD3DF`, background: FT.card, borderRadius: 4, padding: "5px 8px", fontSize: 12.5, color: FT.text, minWidth: 110 }}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function SectionTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8, borderBottom: `1px solid #E4E9F0`, paddingBottom: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: FT.navy }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: FT.textSub }}>{sub}</div>}
      {action && <div style={{ marginLeft: "auto", alignSelf: "center" }}>{action}</div>}
    </div>
  );
}

/** Bloc repliable pour garder les tableaux opérationnels existants sous la vue BI.
 * Contenu monté seulement une fois ouvert (pas de requêtes lourdes tant qu'il est fermé). */
export function DetailSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{ background: FT.card, border: FT.borderCrisp, borderRadius: 6 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: FT.navy, textAlign: "left" }}>
        <ChevronDown size={16} aria-hidden style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }} />
        {title}
      </button>
      {open && <div style={{ padding: "4px 14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>}
    </section>
  );
}
