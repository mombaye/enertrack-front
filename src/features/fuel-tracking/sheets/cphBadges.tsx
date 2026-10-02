// src/features/fuel-tracking/sheets/cphBadges.tsx
// Badges, libellés et infobulles CPH partagés par « Suivis Consommations » et « Contrôle CPH ».
// Deux familles DISTINCTES : mapping_status (correspondance plaque → courbe) et
// curve_source_status (origine / qualité de la courbe). Un mapping automatique ne change
// jamais l'origine de la courbe.

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

import type { CphConsoStatus, CphCorrespondance, CphCurveSourceStatus, CphMatchStatus, CphMotifCode } from "@/services/fuelTracking";
import { FT } from "../theme";

// ─── Infobulles (unités SI) ──────────────────────────────────────────────────

export const GLOSSARY = {
  runtime: "Runtime GE (h) : heures de marche du GE retenues jour par jour sur les dates exactes. Priorité stricte : DSE / contrôleur GE, redresseur (sites off-grid uniquement), Day DG On, compteur horaire terrain. Une source n'est utilisable que si elle est disponible ≥ 50 % des jours ; DSE = 0 est une valeur valide, une valeur absente reste vide.",
  dispo: "Disponibilité runtime (%) : jours où la source retenue a une valeur (0 compris) ÷ jours de la période. Une valeur absente n'est jamais comptée comme 0.",
  puissance: "Puissance GE retenue (kW) : moyenne pondérée par le runtime des jours calculés. Chaîne de repli tentée chaque jour : 1) DSE / production GE (DG_PRODUCTION_KWH ÷ runtime) ; 2) outdoor : P_DC pendant GE ÷ rendement ; 3) indoor : P_DC pendant GE ÷ rendement + load AC historique. Chaque méthode est rejetée au-delà de 1,05 × kVA × 0,8. Jamais de courant batterie ajouté ; ACT_ACTIVE_POWER_AVG n'est jamais une puissance GE directe.",
  sourcePuissance: "Source puissance : méthode retenue sur le plus de jours (le détail jour par jour, avec les méthodes rejetées et leur motif, est dans Contrôle CPH).",
  configuration: "Configuration Indoor / Outdoor : inventaire site (core), à défaut fichier ESCO Facturation par site. Inconnue = la méthode redresseur ne peut pas être choisie (CONFIGURATION_INCONNUE).",
  typeSite: "Type de site : On-Grid / Off-Grid (Base GE, à défaut Snowflake).",
  factureGe: "Facturé avec GE : fichier ESCO SN Facturation par site (Oui / Non), information non bloquante pour le calcul.",
  score: "Score de compatibilité du mapping : modèle (60, variante 40) + marque (20) + puissance à ± 15 % du kVA de la courbe (20). Auto-validation seulement si candidat unique, score ≥ 70 % et aucune contradiction.",
  origineCourbe: "Qualité / origine de la courbe : VALIDE_CONSTRUCTEUR, HISTORIQUE_A_VALIDER, ARCHIVE ou DISTRIBUTEUR. Jamais modifiée par le mapping.",
  charge: "Charge GE (%) : puissance GE retenue ÷ puissance active nominale estimée (kVA × 0,8). Au-delà de 1,05 × kVA × 0,8, le CPH n'est pas calculé (PUISSANCE_HORS_LIMITE).",
  cph: "CPH (L/h) : consommation horaire calculée depuis la courbe CPH du GE au taux de charge retenu : a × charge² + b × charge + c.",
  consoEstimee: "Conso estimée (L) : Runtime GE × CPH, jour par jour. C'est la consommation théorique calculée. « partielle » : certains jours n'ont pas de CPH (motif affiché).",
  consoMesuree: "Conso mesurée vue (L) : consommation provenant de la source Snowflake de mesure fuel (VW_FUEL_REPORT, QUALITY_STATUS = OK, ≥ 2 points valides). Elle est indépendante de la consommation estimée.",
  ecart: "Écart conso (L) = conso mesurée − conso estimée ; écart (%) = écart ÷ conso estimée × 100. Calculé seulement sur les jours où les deux existent.",
  kva: "Puissance nominale GE (kVA) : puissance apparente nominale du GE dans l'inventaire (Base GE).",
  sfc: "Consommation spécifique (L/kWh) = conso ÷ énergie GE (Σ puissance GE × runtime). Référence ~0,25-0,30 L/kWh à charge correcte, plus à faible charge. Hors plage [0,20 ; 0,50] = alerte : estimée → vérifier la courbe ou la puissance ; mesurée → perte, vol ou capteur. Jamais bloquant.",
  mapping: "Mapping plaque → courbe : AUTO_VALIDE_COMPATIBLE (candidat unique, score ≥ 70 %, sans contradiction), VALIDE_MANUELLEMENT, ou exception à traiter dans Contrôle CPH. Le second badge est l'origine de la courbe, jamais modifiée par le mapping.",
  energieSite: "Énergie site (kWh) : énergie électrique consommée par les équipements du site sur la période. Ce n'est pas automatiquement la puissance GE.",
  batterieDc: "Batterie DC (kWh) : énergie DC échangée avec la batterie sur la période (préciser si le signe représente une charge, une décharge ou une valeur absolue).",
  batterieAc: "Batterie AC (kWh) : énergie AC associée aux échanges batterie / redresseur sur la période (convention de signe et périmètre de mesure à préciser).",
} as const;

export function HelpTip({ text, label }: { text: string; label: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const id = useId();
  const WIDTH = 300;
  const show = (el: HTMLElement) => {
    // Portail en position fixe : l'infobulle n'est jamais coupée par un tableau défilant.
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8);
    setPos({ left, top: r.bottom + 6 });
  };
  return (
    <span style={{ display: "inline-flex", marginLeft: 4, verticalAlign: "middle" }}>
      <button
        type="button"
        aria-label={`Aide : ${label}`}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPos(null)}
        onKeyDown={(e) => e.key === "Escape" && setPos(null)}
        style={{ border: "none", background: "transparent", padding: 0, cursor: "help", color: FT.textSub, display: "inline-flex" }}
      >
        <Info size={12} />
      </button>
      {pos && createPortal(
        <span
          id={id}
          role="tooltip"
          className="fuelbook"
          style={{
            position: "fixed", left: pos.left, top: pos.top, zIndex: 10000,
            width: WIDTH, padding: "9px 11px", borderRadius: 8, background: FT.navy, color: "#fff",
            fontSize: 11.5, fontWeight: 500, lineHeight: 1.45, textTransform: "none", letterSpacing: 0,
            textAlign: "left", whiteSpace: "normal", boxShadow: FT.shadowLg, pointerEvents: "none",
          }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}

// ─── Libellés de sources ─────────────────────────────────────────────────────

export const RUNTIME_SOURCE_LABELS: Record<string, string> = {
  DSE: "DSE / contrôleur GE", REDRESSEUR: "Redresseur", DAY_DG_ON: "Day DG On", COMPTEUR_TERRAIN: "Compteur terrain", AUCUNE: "Aucune source",
};

export const POWER_SOURCE_LABELS: Record<string, string> = {
  PRODUCTION_GE: "DSE / production GE",
  DC_REDRESSEUR: "Redresseur (P_DC ÷ rendement)",
  ESTIMATION_HISTORIQUE_LOAD_AC: "ESTIMATION_HISTORIQUE_LOAD_AC",
  AUCUNE: "Aucune",
};

// ─── Mapping plaque → courbe ─────────────────────────────────────────────────

export const MATCH_LABELS: Record<CphMatchStatus, string> = {
  AUTO_VALIDE_COMPATIBLE: "Correspondance unique et compatible (score ≥ 70 %), activée automatiquement",
  VALIDE_MANUELLEMENT: "Correspondance choisie par un validateur",
  A_VALIDER: "Candidat unique mais incompatible ou score insuffisant : validation requise",
  MODELE_AMBIGU: "Plusieurs courbes candidates comparables : choix manuel requis",
  COURBE_CPH_MANQUANTE: "Aucune courbe CPH pour ce type de GE dans l'abaque",
  TYPE_GE_ABSENT: "Type de GE absent de la Base GE",
  SITE_MULTI_GE: "Site multi-GE : une courbe par GE n'est pas encore gérée",
  REJETE: "Correspondance rejetée par un validateur (jamais réactivée automatiquement)",
};

const MATCH_TONES: Record<CphMatchStatus, string> = {
  AUTO_VALIDE_COMPATIBLE: FT.green,
  VALIDE_MANUELLEMENT: FT.blue,
  A_VALIDER: FT.orange,
  MODELE_AMBIGU: FT.violet,
  COURBE_CPH_MANQUANTE: FT.red,
  TYPE_GE_ABSENT: FT.slate,
  SITE_MULTI_GE: FT.slate,
  REJETE: FT.red,
};

// ─── Origine / qualité de la courbe ──────────────────────────────────────────

const RAW_TO_SOURCE: Record<string, CphCurveSourceStatus> = {
  "VALIDÉ_CONSTRUCTEUR": "VALIDE_CONSTRUCTEUR",
  HISTORIQUE_A_VALIDER: "HISTORIQUE_A_VALIDER",
  FICHE_ARCHIVEE_A_VALIDER: "ARCHIVE",
  FICHE_DISTRIBUTEUR_A_VALIDER: "DISTRIBUTEUR",
};

export const CURVE_SOURCE_LABELS: Record<CphCurveSourceStatus, string> = {
  VALIDE_CONSTRUCTEUR: "Courbe issue d'une fiche constructeur validée",
  HISTORIQUE_A_VALIDER: "Courbe historique (base ESCO), à confirmer par fiche constructeur",
  ARCHIVE: "Fiche constructeur archivée, à confirmer",
  DISTRIBUTEUR: "Fiche distributeur, à confirmer",
};

/** Code d'origine (VALIDE_CONSTRUCTEUR…) depuis le code affiché ou le statut brut de l'abaque. */
export function curveSourceCode(status: string | null | undefined): CphCurveSourceStatus | null {
  if (!status) return null;
  return (RAW_TO_SOURCE[status] ?? status) as CphCurveSourceStatus;
}

function Badge({ text, tone, title }: { text: string; tone: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: ".02em", color: tone,
        background: `${tone}14`, border: `1px solid ${tone}40`, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export function MatchBadge({ statut, title }: { statut: CphMatchStatus | string | null | undefined; title?: string }) {
  if (!statut) return <span style={{ color: FT.textSub }}>—</span>;
  const s = statut as CphMatchStatus;
  return <Badge text={s} tone={MATCH_TONES[s] ?? FT.slate} title={title ?? MATCH_LABELS[s]} />;
}

export function CurveStatusBadge({ status }: { status: string | null | undefined }) {
  const code = curveSourceCode(status);
  if (!code) return null;
  const tone = code === "VALIDE_CONSTRUCTEUR" ? FT.green : FT.slate;
  return <Badge text={code} tone={tone} title={`Origine de la courbe : ${CURVE_SOURCE_LABELS[code] ?? code}`} />;
}

/** Mapping + origine de courbe : deux badges distincts, score et méthode en infobulle. */
export function CorrespondanceCell({ c, fallbackCurveId }: { c: CphCorrespondance | null | undefined; fallbackCurveId?: string | null }) {
  if (!c) return <span style={{ color: FT.textSub }}>—</span>;
  const tip = [
    MATCH_LABELS[c.statut],
    c.score !== null && c.score !== undefined ? `score ${c.score} %` : null,
    c.methode ? `méthode ${c.methode}` : null,
    c.valide_par ? `par ${c.valide_par}` : null,
    c.date ? `le ${new Date(c.date).toLocaleDateString("fr-FR")}` : null,
    c.motif,
  ].filter(Boolean).join(" · ");
  const curveId = c.courbe_id ?? fallbackCurveId;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        <MatchBadge statut={c.statut} title={tip} />
        {c.score !== null && c.score !== undefined && <span style={{ fontSize: 10.5, color: FT.textSub }}>{c.score} %</span>}
      </span>
      {curveId && (
        <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace", color: FT.textMid }}>{curveId}</span>
          <CurveStatusBadge status={c.curve_source_status ?? c.courbe_statut} />
        </span>
      )}
    </div>
  );
}

// ─── Motifs d'absence de CPH ─────────────────────────────────────────────────

export const MOTIF_LABELS: Record<CphMotifCode, string> = {
  RUNTIME_INDISPONIBLE: "Aucune donnée de runtime GE",
  RUNTIME_NON_QUALIFIE: "Runtime présent mais non qualifié (bornes, disponibilité < 50 %)",
  PUISSANCE_INDISPONIBLE: "Puissance GE non disponible",
  PUISSANCE_HORS_LIMITE: "Puissance GE hors limite (> 1,05 × kVA × 0,8 ou hors domaine de la courbe)",
  PUISSANCE_NOMINALE_ABSENTE: "Puissance nominale GE inconnue",
  RENDEMENT_REDRESSEUR_INVALIDE: "Rendement redresseur invalide",
  COURBE_CPH_MANQUANTE: "Aucune courbe CPH pour ce type de GE",
  MAPPING_GE_A_VALIDER: "Mapping plaque → courbe à valider",
  MODELE_GE_AMBIGU: "Plusieurs courbes candidates (modèle ambigu)",
  SITE_MULTI_GE: "Site multi-GE",
  TYPE_GE_ABSENT: "Type de GE absent de la Base GE",
  PERIODE_INCOMPLETE: "PÉRIODE INCOMPLÈTE : jours après la dernière donnée Snowflake",
  CONFIGURATION_INCONNUE: "Configuration Indoor/Outdoor inconnue",
};

// ─── Comparaison estimée / mesurée ───────────────────────────────────────────

export const CONSO_STATUS_LABELS: Record<CphConsoStatus, string> = {
  CONSO_ESTIMEE_NON_CALCULEE: "Conso estimée non calculée",
  MESURE_ABSENTE: "Mesure absente",
  COHERENT: "Cohérent",
  ECART_A_JUSTIFIER: "Écart à justifier",
  ECART_A_INVESTIGUER: "Écart à investiguer",
};

export const CONSO_STATUS_COLORS: Record<CphConsoStatus, string> = {
  CONSO_ESTIMEE_NON_CALCULEE: FT.violet,
  MESURE_ABSENTE: FT.slate,
  COHERENT: FT.green,
  ECART_A_JUSTIFIER: FT.orange,
  ECART_A_INVESTIGUER: FT.red,
};

export function ConsoStatusBadge({ statut }: { statut: CphConsoStatus }) {
  const color = CONSO_STATUS_COLORS[statut] ?? FT.slate;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, color, background: `${color}1f`, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
      {CONSO_STATUS_LABELS[statut] ?? statut}
    </span>
  );
}

/** Données Snowflake périmées ou synchro en échec : bandeau d'avertissement commun aux deux écrans. */
export function FreshnessWarning({ meta }: { meta: { facts_last_date: string | null; facts_age_days?: number | null; facts_stale?: boolean; stale_after_days?: number; last_sync_failed?: boolean; last_sync_error?: string | null } | undefined }) {
  if (!meta || (!meta.facts_stale && !meta.last_sync_failed)) return null;
  const parts: string[] = [];
  if (meta.facts_stale) {
    parts.push(meta.facts_last_date
      ? `Données Snowflake périmées : dernière journée disponible ${meta.facts_last_date.split("-").reverse().join("/")} (${meta.facts_age_days} j, seuil ${meta.stale_after_days ?? 3} j). Les jours suivants ne sont pas calculés.`
      : "Aucune donnée Snowflake synchronisée pour le calcul CPH.");
  }
  if (meta.last_sync_failed) parts.push(`Dernière synchronisation Snowflake en échec${meta.last_sync_error ? ` : ${meta.last_sync_error}` : ""}.`);
  return (
    <div role="alert" style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "#fffbe6", border: "1px solid #ffe58f", color: "#ad6800", fontSize: 12 }}>
      ⚠ {parts.join(" ")}
    </div>
  );
}
