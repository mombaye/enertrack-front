// src/features/fuel-tracking/bi/kit.tsx
// Briques « BI » du Suivi carburant : bandeau d'indicateurs, cartes graphiques, tableaux classés
// avec barres de données, filtres et export Excel. Couleurs Camusat (navy #0B1F4D / bleu #1A56C4,
// voir theme.ts). Une valeur absente s'affiche « — », jamais 0.

import { Children, createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Download, Info } from "lucide-react";
import type { KpiExplain } from "@/services/fuelTracking";
import { FT, toneColors, type Tone } from "../theme";
import { Card, Modal, Skeleton } from "../ui";

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

/** Valeurs exactes de la maquette validée (Suivi Carburant v6) pour le bandeau d'indicateurs. */
export const KPI = { line: "#E6EAF0", fg: "#0B1220", fg2: "#4B5768", fg3: "#7D889B", crit: "#D03B3B", good: "#006300", radius: 10 } as const;
export const kpiCell: CSSProperties = { background: "#FFFFFF", padding: "14px 18px 15px", minWidth: 0, textAlign: "left" };

/** Identifiant stable d'un bloc (graphique ou classement) à partir de son titre : cible des clics sur les KPIs. */
export const blocId = (title: string) => "bloc-" + title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Fait défiler jusqu'au bloc et le met brièvement en évidence. Retourne false si le bloc n'est pas affiché. */
export function goToBloc(title: string): boolean {
  const el = document.getElementById(blocId(title));
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // Sécurité : si le défilement animé n'a pas abouti (navigateur qui l'interrompt), saut direct.
  window.setTimeout(() => { if (Math.abs(el.getBoundingClientRect().top - 110) > 60) el.scrollIntoView({ block: "start" }); }, 700);
  el.classList.remove("ft-focus");
  void el.offsetWidth; // relance l'animation
  el.classList.add("ft-focus");
  // Focus clavier sur le bloc une fois le défilement terminé (un focus pendant l'animation l'interrompt).
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  let done = false;
  const focus = () => { if (done) return; done = true; el.focus({ preventScroll: true }); };
  window.addEventListener("scrollend", focus, { once: true });
  window.setTimeout(focus, 1200);
  return true;
}

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
  // Nombre de cases réellement affichées (un enfant peut en rendre plusieurs) : compté dans le DOM.
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(() => Children.count(children));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const count = () => setN(Array.from(el.children).filter((c) => c.tagName !== "STYLE").length);
    count();
    const mo = new MutationObserver(count);
    mo.observe(el, { childList: true });
    return () => mo.disconnect();
  }, []);
  // Comme la maquette : 4 colonnes (3 pour 6 indicateurs), 2 sous 900 px, 1 sous 520 px.
  const cols = n === 6 ? 3 : n === 5 ? 5 : Math.min(Math.max(n, 1), 4);
  return (
    <div ref={ref} className="bi-kpirow" style={{
      display: "grid", gap: 1, ["--n" as string]: cols,
      background: KPI.line, border: `1px solid ${KPI.line}`, borderRadius: KPI.radius, overflow: "hidden",
    } as CSSProperties} data-kpis={n}>
      {/* La balise style est le 1er enfant : une case seule en fin de ligne est donc un enfant de rang pair. */}
      <style>{`.bi-kpirow{grid-template-columns:repeat(var(--n),minmax(0,1fr))}`
        + `@media (max-width:900px){.bi-kpirow{grid-template-columns:repeat(2,minmax(0,1fr))}.bi-kpirow>:last-child:nth-child(even){grid-column:1/-1}}`
        + `@media (max-width:520px){.bi-kpirow{grid-template-columns:1fr}}`
        + `.bi-kpi:hover{background:#F6F8FB !important}.bi-kpi:focus-visible{outline:2px solid #1A56C4;outline-offset:-2px}`}</style>
      {children}
    </div>
  );
}

/**
 * Indicateur sobre : libellé, valeur, puis une courte phrase de contexte (variation en texte simple, sans flèche ni pastille).
 * La couleur ne sert qu'aux alertes réelles.
 * `upIsGood` décide de la couleur de la variation ; `alert` colore la valeur quand elle sort de la norme.
 * Avec `explain`, la cellule est cliquable et ouvre le détail du calcul.
 */
export function BiKpi({ label, value, unit, delta, deltaUnit = "%", upIsGood = true, sub, alert, explain, detail, detailLabel }: {
  label: string; value: string; unit?: string; delta?: number | null; deltaUnit?: "%" | "pts"; upIsGood?: boolean;
  sub?: ReactNode; alert?: "bad" | "warn" | null; explain?: KpiExplain | null;
  /** Titre du bloc de la page qui détaille ce chiffre (classement ou graphique). */
  detail?: string; detailLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasDelta = delta != null;
  const color = !hasDelta || delta === 0 ? KPI.fg2 : (delta > 0) === upIsGood ? KPI.good : KPI.crit;
  const body = (
    <>
      <div style={{ color: KPI.fg2, fontSize: 12.5, fontWeight: 400, lineHeight: 1.45 }}>{label}</div>
      <div style={{ marginTop: 3, lineHeight: 1.15 }}>
        <span style={{ color: alert ? KPI.crit : KPI.fg, fontSize: 25, fontWeight: 600, letterSpacing: "-.01em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {unit && value !== "—" && <span style={{ color: KPI.fg3, fontSize: 13, fontWeight: 400, marginLeft: 3 }}>{unit}</span>}
      </div>
      <div style={{ marginTop: 3, fontSize: 12, color: KPI.fg3, lineHeight: 1.45 }}>
        {hasDelta && (
          <span style={{ color, fontWeight: 600, marginRight: 6, whiteSpace: "nowrap" }}>
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}{nf1.format(Math.abs(delta))} {deltaUnit === "pts" ? "pt" : "%"}
          </span>
        )}
        {sub}
      </div>
    </>
  );
  const cell = kpiCell;
  // Un clic ouvre toujours le détail (jamais une redirection directe vers le tableau) ; le tableau reste accessible
  // depuis la fenêtre. Sans détail de calcul reçu (chargement, mesure non calculée), la fenêtre le dit.
  if (!explain && !detail) return <div style={cell}>{body}</div>;
  const x: KpiExplain = explain ?? {
    titre: label, formule: "Détail du calcul non disponible pour le moment (chiffre en cours de chargement ou non calculé sur cette période).",
    valeurs: [], sources: [], perimetre: [], exclusions: [], mise_a_jour: null, note: null,
  };
  return (
    <>
      <button type="button" className="bi-kpi" onClick={() => setOpen(true)} aria-haspopup="dialog"
        title={detail ? "Voir le calcul et les sites concernés" : "Voir le détail du calcul"}
        style={{ ...cell, border: "none", font: "inherit", cursor: "pointer", width: "100%", display: "block" }}>
        {body}
      </button>
      {open && <ExplainModal x={x} value={value} unit={unit} onClose={() => setOpen(false)}
        detail={detail} detailLabel={detailLabel} />}
    </>
  );
}

const fVal = (v: number | string | null, unite: string) => {
  if (v == null) return "Non disponible";
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v).toLocaleDateString("fr-FR") : `${v}${unite ? ` ${unite}` : ""}`;
  const n = Math.abs(v) >= 100 ? nf0.format(v) : nf2.format(v).replace(/,00$/, "");
  return `${n}${unite ? ` ${unite}` : ""}`;
};

/** Fenêtre « D'où vient ce chiffre » : formule, valeurs du calcul, sources, périmètre, exclusions, fraîcheur. */
export function ExplainModal({ x, value, unit, onClose, detail, detailLabel }: {
  x: KpiExplain; value: string; unit?: string; onClose: () => void; detail?: string; detailLabel?: string;
}) {
  const h: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: FT.textMid, margin: "16px 0 6px" };
  return (
    <Modal title={x.titre} onClose={onClose} maxWidth={600}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flex: 1 }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: FT.navy, fontVariantNumeric: "tabular-nums" }}>{value}</span>
          {unit && value !== "—" && <span style={{ fontSize: 14, color: FT.textMid, fontWeight: 600 }}>{unit}</span>}
        </div>
        {detail && (
          <button type="button" onClick={() => { onClose(); window.setTimeout(() => goToBloc(detail), 60); }}
            style={{ border: "none", background: FT.navy, color: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            {detailLabel ?? "Voir les sites concernés"} →
          </button>
        )}
      </div>
      <div style={{ marginTop: 10, padding: "10px 12px", background: FT.slateL, borderLeft: `3px solid ${FT.navy}`, fontSize: 13, color: FT.text, lineHeight: 1.45 }}>
        {x.formule}
      </div>

      {x.valeurs.length > 0 && <div style={h}>Valeurs utilisées</div>}
      {x.valeurs.length > 0 && <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {x.valeurs.map((v) => (
            <tr key={v.label}>
              <td style={{ padding: "5px 0", borderBottom: "1px solid #EEF1F5", color: FT.textMid }}>{v.label}</td>
              <td style={{ padding: "5px 0", borderBottom: "1px solid #EEF1F5", textAlign: "right", fontWeight: 600, color: v.valeur == null ? FT.textSub : FT.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {fVal(v.valeur, v.unite)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>}

      {x.perimetre.length > 0 && (<>
        <div style={h}>Périmètre</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: FT.text, lineHeight: 1.6 }}>{x.perimetre.map((p) => <li key={p}>{p}</li>)}</ul>
      </>)}

      {x.exclusions.length > 0 && (<>
        <div style={h}>Non pris en compte</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <tbody>
            {x.exclusions.map((e) => (
              <tr key={e.label}>
                <td style={{ padding: "4px 0", color: FT.text }}>{e.label}</td>
                <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{nf0.format(e.nb)} sites</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>)}

      {x.sources.length > 0 && <div style={h}>Sources</div>}
      {x.sources.length > 0 && <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: FT.text, lineHeight: 1.6 }}>{x.sources.map((s) => <li key={s}>{s}</li>)}</ul>}

      {x.note && <div style={{ marginTop: 14, fontSize: 12.5, color: FT.textMid, lineHeight: 1.45 }}>{x.note}</div>}
      <div style={{ marginTop: 16, paddingTop: 10, borderTop: "1px solid #EEF1F5", fontSize: 11.5, color: FT.textSub }}>
        {x.mise_a_jour ? `Données synchronisées le ${new Date(x.mise_a_jour).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Date de synchronisation inconnue"}
        {" · la liste complète site par site est dans l'export Excel."}
      </div>
    </Modal>
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
    <Card id={blocId(title)} style={{ padding: "14px 16px", minWidth: 0, borderRadius: 6 }}>
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
    <Card id={blocId(title)} style={{ padding: "14px 16px", minWidth: 0, borderRadius: 6 }}>
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

/** Ouvre la fiche d'un site (fournie par la page Suivi carburant). Absent = cellule non cliquable. */
export const OpenSiteContext = createContext<((siteId: string) => void) | null>(null);

export function SiteCell({ id, name }: { id: string; name?: string | null }) {
  const open = useContext(OpenSiteContext);
  return (
    <div style={{ minWidth: 0, lineHeight: 1.25 }}>
      {open
        ? <button type="button" onClick={(e) => { e.stopPropagation(); open(id); }} title={`Ouvrir la fiche du site ${id}`}
            style={{ all: "unset", cursor: "pointer", fontWeight: 600, color: FT.navy, textDecoration: "underline", textDecorationColor: "#B8C6DE", textUnderlineOffset: 3 }}>{id}</button>
        : <span style={{ fontWeight: 600, color: FT.navy }}>{id}</span>}
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
/** Ligne de titre d'une page (comme la maquette) : titre, filtres propres à la page, note, export. */
export function FilterBar({ children, note, onExport, title }: { children?: ReactNode; note?: ReactNode; onExport?: () => Promise<void>; title?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "2px 0" }}>
      {title && <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.015em", color: "#0B1220", marginRight: 6 }}>{title}</h2>}
      {children}
      {note && <span style={{ fontSize: 12, color: FT.textMid }}>{note}</span>}
      {onExport && <span style={{ marginLeft: "auto" }}><ExportButton onExport={onExport} /></span>}
    </div>
  );
}

export function FilterSelect({ label, value, options, onChange, allLabel = "Tous", format }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; allLabel?: string; format?: (o: string) => string;
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
        {options.map((o) => <option key={o} value={o}>{format ? format(o) : o}</option>)}
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
