// src/features/fuel-tracking/sheets/cphDiagnostics.tsx
// Blocs d'audit CPH partagés par « Suivis Consommations » et « Contrôle CPH » :
// couvertures distinctes (numérateur / dénominateur / définition), statuts CPH et
// rapprochement séparés, synthèse des blocages filtrable, chaîne de repli puissance
// d'un jour et diagnostic du load AC historique. Aucune valeur recalculée ici.

import type { CSSProperties } from "react";

import type {
  CphAcReference, CphAcStatus, CphCouverture, CphDay, CphDiagnosticBlocage, CphMethodAttempt, CphPeriodeInfo,
  CphPowerMethod, CphStatutCph, CphStatutRapprochement,
} from "@/services/fuelTracking";
import { FT } from "../theme";
import { HelpTip } from "./cphBadges";

const mono: CSSProperties = { fontFamily: "ui-monospace, Menlo, monospace" };

function nf(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function frDate(iso: string | null | undefined) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

function Pill({ text, color, title }: { text: string; color: string; title?: string }) {
  return (
    <span title={title} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, color, background: `${color}1a`, border: `1px solid ${color}40`, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

// ─── Méthodes de puissance ───────────────────────────────────────────────────

export const POWER_METHOD_LABELS: Record<CphPowerMethod, string> = {
  DIRECT_DSE_PRODUCTION: "DSE / production GE",
  PDC_REDRESSEUR: "Outdoor : P_DC ÷ rendement",
  INDOOR_PDC_LOAD_AC: "Indoor : P_DC + load AC",
};

export const POWER_METHOD_FORMULAS: Record<CphPowerMethod, string> = {
  DIRECT_DSE_PRODUCTION: "P_GE = DG_PRODUCTION_KWH ÷ runtime (énergie GE du jour ÷ heures de marche)",
  PDC_REDRESSEUR: "P_GE = P_DC pendant GE ÷ rendement redresseur (0 < η ≤ 1), sans batterie",
  INDOOR_PDC_LOAD_AC: "P_GE = P_DC pendant GE ÷ η + load AC historique (jours réseau sans GE), sans batterie",
};

const ATTEMPT_COLORS: Record<CphMethodAttempt["statut"], string> = {
  RETENUE: FT.green, REJETEE: FT.red, ABSENTE: FT.orange, NON_APPLICABLE: FT.slate, NON_TENTEE: FT.slate,
};
const ATTEMPT_LABELS: Record<CphMethodAttempt["statut"], string> = {
  RETENUE: "Retenue", REJETEE: "Rejetée", ABSENTE: "Donnée absente", NON_APPLICABLE: "Non applicable", NON_TENTEE: "Non tentée",
};

// ─── Statuts séparés CPH / rapprochement ─────────────────────────────────────

export const STATUT_CPH_LABELS: Record<CphStatutCph, string> = {
  CPH_CALCULE: "CPH calculé", CPH_PARTIEL: "CPH partiel", CPH_NON_CALCULE: "CPH non calculé",
  NON_CONCERNE_SANS_GE: "Hors calcul : sans GE confirmé",
};
const STATUT_CPH_COLORS: Record<CphStatutCph, string> = {
  CPH_CALCULE: FT.green, CPH_PARTIEL: FT.orange, CPH_NON_CALCULE: FT.violet, NON_CONCERNE_SANS_GE: FT.slate,
};

export const STATUT_RAPPRO_LABELS: Record<CphStatutRapprochement, string> = {
  RAPPROCHEMENT_CALCULE: "Rapprochement calculé",
  RAPPROCHEMENT_NON_CALCULE_STOCK_ABSENT: "Stock absent",
  RAPPROCHEMENT_NON_CALCULE_MOUVEMENTS_ABSENTS: "Mouvements absents / non validés",
  RAPPROCHEMENT_NON_CALCULE_CPH_INCOMPLET: "CPH incomplet sur la fenêtre du relevé",
};
const STATUT_RAPPRO_COLORS: Record<CphStatutRapprochement, string> = {
  RAPPROCHEMENT_CALCULE: FT.green,
  RAPPROCHEMENT_NON_CALCULE_STOCK_ABSENT: FT.slate,
  RAPPROCHEMENT_NON_CALCULE_MOUVEMENTS_ABSENTS: FT.orange,
  RAPPROCHEMENT_NON_CALCULE_CPH_INCOMPLET: FT.violet,
};

export function StatutCphBadge({ statut, title }: { statut: CphStatutCph | null | undefined; title?: string }) {
  if (!statut) return null;
  return <Pill text={statut} color={STATUT_CPH_COLORS[statut] ?? FT.slate} title={title ?? STATUT_CPH_LABELS[statut]} />;
}

export function StatutRapproBadge({ statut }: { statut: CphStatutRapprochement | null | undefined }) {
  if (!statut) return null;
  return <Pill text={STATUT_RAPPRO_LABELS[statut] ?? statut} color={STATUT_RAPPRO_COLORS[statut] ?? FT.slate} title={statut} />;
}

export const AC_STATUS_LABELS: Record<CphAcStatus, string> = {
  LOAD_AC_QUALIFIE: "Load AC qualifié",
  LOAD_AC_MESURE_ZERO: "Load AC réellement égal à zéro (mesuré)",
  LOAD_AC_INDISPONIBLE: "Load AC indisponible (NULL, pas 0)",
  LOAD_AC_INCOHERENT: "Load AC incohérent : P_AC < P_DC entrée (NULL, pas 0)",
  LOAD_AC_UNITE_SUSPECTE: "Unité Active Power Avg suspecte (NULL, pas 0)",
};
const AC_STATUS_COLORS: Record<CphAcStatus, string> = {
  LOAD_AC_QUALIFIE: FT.green, LOAD_AC_MESURE_ZERO: FT.cyan, LOAD_AC_INDISPONIBLE: FT.slate,
  LOAD_AC_INCOHERENT: FT.red, LOAD_AC_UNITE_SUSPECTE: FT.orange,
};

export function AcStatusBadge({ statut }: { statut: CphAcStatus | null | undefined }) {
  if (!statut) return null;
  return <Pill text={statut} color={AC_STATUS_COLORS[statut] ?? FT.slate} title={AC_STATUS_LABELS[statut]} />;
}

// ─── Période incomplète ──────────────────────────────────────────────────────

export function PeriodeIncompleteBanner({ periode }: { periode: CphPeriodeInfo | undefined }) {
  if (!periode?.incomplete) return null;
  return (
    <div role="status" style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: FT.orangeL, border: `1px solid ${FT.orange}55`, color: "#92400E", fontSize: 12 }}>
      <strong>PÉRIODE INCOMPLÈTE</strong> — données Snowflake disponibles jusqu'au {frDate(periode.donnees_jusqu_au)} :
      {" "}{periode.jours_sans_donnees} jour(s) de la période ne sont pas encore calculables. Les sommes affichées ne couvrent
      que les jours calculés (jamais présentées comme une consommation complète).
    </div>
  );
}

// ─── Couvertures ─────────────────────────────────────────────────────────────

const COVERAGE_TONES: Record<CphCouverture["code"], string> = {
  conso_mesuree: FT.slate, runtime: FT.blue, mapping: FT.cyan, puissance: FT.orange, cph: FT.violet, rapprochement: FT.green,
};

export function CoverageKpis({ items }: { items: CphCouverture[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
      {items.map((c) => {
        const tone = COVERAGE_TONES[c.code] ?? FT.slate;
        return (
          <div key={c.code} style={{ border: FT.borderCrisp, borderLeft: `3px solid ${tone}`, background: FT.card, borderRadius: FT.radius, padding: "10px 12px", boxShadow: FT.shadow }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 10, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".04em" }}>
              {c.label}
              <HelpTip text={`${c.definition} Numérateur : ${c.numerateur.toLocaleString("fr-FR")} · dénominateur : ${c.denominateur.toLocaleString("fr-FR")}.`} label={c.label} />
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: FT.text, ...mono }}>{c.pct === null ? "—" : `${nf(c.pct, 1)} %`}</span>
              <span style={{ fontSize: 11.5, color: FT.textMid, ...mono }}>{c.numerateur.toLocaleString("fr-FR")} / {c.denominateur.toLocaleString("fr-FR")}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Synthèse des blocages ───────────────────────────────────────────────────

const cell: CSSProperties = { padding: "7px 10px", borderBottom: `1px solid ${FT.border}`, fontSize: 12, textAlign: "right", whiteSpace: "nowrap" };
const head: CSSProperties = { ...cell, fontSize: 10.5, fontWeight: 800, color: FT.text, textTransform: "uppercase", letterSpacing: ".03em", background: FT.slateL, position: "sticky", top: 0 };

export function BlocageDiagnostic({
  items, active, onSelect, showEmpty = false,
}: { items: CphDiagnosticBlocage[] | undefined; active?: string; onSelect: (code: string | undefined) => void; showEmpty?: boolean }) {
  if (!items) return null;
  const rows = showEmpty ? items : items.filter((b) => b.sites > 0);
  if (!rows.length) return <div style={{ fontSize: 12.5, color: FT.textSub }}>Aucun blocage sur la période.</div>;
  return (
    <div style={{ overflow: "auto", maxHeight: 420, borderRadius: 10, border: `1px solid ${FT.border}` }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 820 }}>
        <caption className="sr-only">Synthèse des blocages du calcul CPH par motif</caption>
        <thead>
          <tr>
            <th scope="col" style={{ ...head, textAlign: "left" }}>Motif</th>
            <th scope="col" style={head}>Sites</th>
            <th scope="col" style={head}>Jours</th>
            <th scope="col" style={head}>Runtime concerné (h)</th>
            <th scope="col" style={head}>Conso mesurée dispo (L)</th>
            <th scope="col" style={head}>
              Volume potentiel non calculé (L)
              <HelpTip label="volume potentiel" text="Indicatif : runtime des jours bloqués × CPH moyen du site sur ses jours calculés de la période. Seulement pour les sites qui ont un CPH ailleurs sur la période ; jamais ajouté à la conso estimée." />
            </th>
            <th scope="col" style={{ ...head, textAlign: "center" }}>Sites concernés</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const isActive = active === b.code;
            return (
              <tr key={b.code} style={{ background: isActive ? FT.blueL : b.sites === 0 ? FT.cardAlt : "#fff", color: b.sites === 0 ? FT.textSub : FT.text }}>
                <td style={{ ...cell, textAlign: "left", whiteSpace: "normal" }}>
                  <div style={{ fontWeight: 700 }}>{b.label}{!b.bloquant && <span style={{ marginLeft: 6, fontSize: 10.5, color: FT.cyan, fontWeight: 800 }}>INFO</span>}</div>
                  <div style={{ fontSize: 10.5, color: FT.textSub, ...mono }}>{b.code} · {b.type === "jour" ? "jours non calculés" : "niveau site"}</div>
                </td>
                <td style={{ ...cell, ...mono, fontWeight: 800 }}>{b.sites.toLocaleString("fr-FR")}</td>
                <td style={{ ...cell, ...mono }}>{b.type === "jour" ? b.jours.toLocaleString("fr-FR") : "—"}</td>
                <td style={{ ...cell, ...mono }}>{nf(b.runtime_h, 1)}</td>
                <td style={{ ...cell, ...mono }}>{nf(b.conso_mesuree_l, 0)}</td>
                <td style={{ ...cell, ...mono }} title={b.sites_volume_potentiel ? `${b.sites_volume_potentiel} site(s) avec un CPH ailleurs sur la période` : "Non calculable : aucun CPH sur la période pour ces sites"}>
                  {nf(b.volume_potentiel_l, 0)}
                </td>
                <td style={{ ...cell, textAlign: "center" }}>
                  {b.sites > 0 && (
                    <button type="button" aria-pressed={isActive} onClick={() => onSelect(isActive ? undefined : b.code)}
                      style={{ border: `1px solid ${isActive ? FT.blue : FT.border}`, background: isActive ? FT.blue : FT.card, color: isActive ? "#fff" : FT.blue, borderRadius: 7, padding: "3px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                      {isActive ? "Filtre actif ×" : "Filtrer"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Chaîne de repli puissance d'un jour ─────────────────────────────────────

export function PowerTrace({ day }: { day: CphDay }) {
  const trace = day.power_trace;
  if (!trace) return null;
  const raw = day.power_raw ?? null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, color: FT.textMid }}>
        Valeurs brutes du jour : production {nf(raw?.production_kwh, 2)} kWh · P_DSE {nf(raw?.p_dse_kw, 2)} kW ·
        P_DC {nf(raw?.p_dc_kw, 2)} kW · rendement {nf(raw?.rendement, 3)} · Active Power Avg {nf(raw?.ac_avg_brut, 0)} W ·
        plafond 1,05 × kVA × 0,8 = {nf(day.power_cap_kw, 2)} kW
      </div>
      <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
        {(Object.keys(POWER_METHOD_LABELS) as CphPowerMethod[]).map((m) => {
          const t = trace[m];
          if (!t) return null;
          return (
            <li key={m} style={{ fontSize: 11.5, color: FT.text }}>
              <span style={{ fontWeight: 800 }}>{POWER_METHOD_LABELS[m]}</span>{" "}
              <Pill text={ATTEMPT_LABELS[t.statut] ?? t.statut} color={ATTEMPT_COLORS[t.statut] ?? FT.slate} />
              {t.valeur_kw !== null && <span style={{ marginLeft: 6, ...mono }}>{nf(t.valeur_kw, 2)} kW</span>}
              <div style={{ fontSize: 11, color: t.statut === "RETENUE" ? FT.textMid : FT.textSub, whiteSpace: "normal" }} title={POWER_METHOD_FORMULAS[m]}>
                {t.detail ?? t.motif ?? POWER_METHOD_FORMULAS[m]}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Load AC historique (indoor) ─────────────────────────────────────────────

export function AcReferencePanel({ ac }: { ac: CphAcReference | null | undefined }) {
  if (!ac) return null;
  const item = (label: string, value: string, tip?: string) => (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".04em" }}>
        {label}{tip && <HelpTip text={tip} label={label} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: FT.text, ...mono }}>{value}</div>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <AcStatusBadge statut={ac.statut} />
        <span style={{ fontSize: 12, color: FT.textMid }}>{AC_STATUS_LABELS[ac.statut]}</span>
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {item("Load AC retenu", ac.p_ac_aux_kw === null ? "NULL" : `${nf(ac.p_ac_aux_kw, 3)} kW`, "Médiane de max(0, P_AC − P_DC entrée) sur les jours de référence. NULL si les mesures sont absentes, insuffisantes, incohérentes ou d'unité suspecte : jamais 0 par défaut.")}
        {item("Jours de référence", String(ac.jours_reference), "Jours du même site, réseau présent, GE absent (DSE ou compteur = 0), avec Active Power Avg, P_DC et rendement mesurés ; 60 jours d'historique, 5 minimum.")}
        {item("Mesures Active Power Avg", ac.mesures === null ? "— (resynchro)" : ac.mesures.toLocaleString("fr-FR"))}
        {item("Médiane Active Power Avg", `${nf(ac.mediane_ac_brut, 0)} ${ac.unite_brute} → ${nf(ac.mediane_ac_kw, 3)} ${ac.unite_convertie}`, `Unité brute ${ac.unite_brute}, conversion ÷ ${nf(ac.diviseur, 0)} → ${ac.unite_convertie}.`)}
        {item("Médiane P_DC entrée", `${nf(ac.mediane_p_dc_entree_kw, 3)} kW`, "P_DC ÷ rendement des jours de référence (puissance absorbée côté AC par le redresseur).")}
        {item("Médiane P_AC − P_DC entrée", `${nf(ac.mediane_ecart_brut_kw, 3)} kW`)}
        {item("Jours P_AC < P_DC entrée", `${ac.jours_ecart_negatif} / ${ac.jours_reference}`)}
      </div>
      {ac.reason && <div style={{ fontSize: 11.5, color: FT.textMid }}>{ac.reason}</div>}
      {ac.candidats.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: FT.blue }}>Valeurs lues par jour de référence ({ac.candidats.length})</summary>
          <div style={{ overflow: "auto", maxHeight: 260, marginTop: 6 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  {["Date", `Active Power Avg (${ac.unite_brute})`, `P_AC (${ac.unite_convertie})`, "P_DC entrée (kW)", "P_AC − P_DC (kW)", "Points"].map((h) => (
                    <th key={h} scope="col" style={head}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ac.candidats.map((c) => {
                  const gap = c.ac_kw !== null && c.p_dc_entree_kw !== null ? c.ac_kw - c.p_dc_entree_kw : null;
                  return (
                    <tr key={c.date}>
                      <td style={{ ...cell, ...mono }}>{frDate(c.date)}</td>
                      <td style={{ ...cell, ...mono }}>{nf(c.ac_brut, 1)}</td>
                      <td style={{ ...cell, ...mono }}>{nf(c.ac_kw, 3)}</td>
                      <td style={{ ...cell, ...mono }}>{nf(c.p_dc_entree_kw, 3)}</td>
                      <td style={{ ...cell, ...mono, color: gap !== null && gap < 0 ? FT.red : FT.text }}>{nf(gap, 3)}</td>
                      <td style={{ ...cell, ...mono }}>{c.points ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Base de sites unique ────────────────────────────────────────────────────

/** Sites hors référentiel (Gestion des sites) : non affichés, à importer pour apparaître partout. */
export function HorsReferentielBanner({ count, what = "site(s)" }: { count: number | undefined; what?: string }) {
  if (!count) return null;
  return (
    <div role="status" style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: FT.blueL, border: `1px solid ${FT.blue}40`, color: FT.navy, fontSize: 12 }}>
      Base de sites unique : seuls les sites de <strong>Gestion des sites</strong> sont affichés. {count.toLocaleString("fr-FR")} {what}
      {" "}connu(s) de Snowflake / ENOC / fichiers Ops n'y figure(nt) pas — importez-les dans Gestion des sites (Import Sites) pour les voir ici.
    </div>
  );
}
