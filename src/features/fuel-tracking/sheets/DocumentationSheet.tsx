// src/features/fuel-tracking/sheets/DocumentationSheet.tsx
// Rubrique « Documentation » du Suivi Carburant : d'où viennent les données, comment elles sont traitées, où elles s'affichent.
// Page statique (aucun appel API) : elle décrit les règles en vigueur (bilan-v3-mvp).
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDown, ArrowRight, Calculator, CheckCircle2, Database, FileSpreadsheet, Fuel, Gauge, LayoutDashboard,
  RefreshCw, Settings2, ShieldCheck, Truck, Upload, AlertTriangle, XCircle, Cpu, Target, CalendarRange,
} from "lucide-react";
import { FT, toneColors, type Tone } from "../theme";

const card: CSSProperties = { background: FT.card, border: FT.borderCrisp, borderRadius: FT.radius, boxShadow: FT.shadow };

function Section({ n, title, sub, children }: { n: number; title: string; sub: string; children: ReactNode }) {
  return (
    <section style={{ ...card, padding: 20, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ minWidth: 28, height: 28, borderRadius: 14, background: FT.navy, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>{n}</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: FT.text }}>{title}</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: FT.textMid }}>{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Node({ icon, title, lines, tone = "blue" }: { icon: ReactNode; title: string; lines: string[]; tone?: Tone }) {
  const c = toneColors(tone);
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: FT.radiusSm, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.fg, fontWeight: 700, fontSize: 13 }}>
        <span style={{ display: "inline-flex", width: 16, height: 16 }}>{icon}</span>{title}
      </div>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: FT.textMid, lineHeight: 1.5 }}>
        {lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </div>
  );
}

function Column({ label, tone, children }: { label: string; tone: Tone; children: ReactNode }) {
  const c = toneColors(tone);
  return (
    <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ textAlign: "center", fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: c.fg, textTransform: "uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

const Arrow = () => (
  <div className="doc-arrow" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: FT.textSub, flex: "0 0 28px" }}>
    <ArrowRight size={26} />
  </div>
);

function FlowOverview() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
      <Column label="1 · Sources d'entrée" tone="violet">
        <Node tone="violet" icon={<FileSpreadsheet />} title="Fichier Closing (mensuel)" lines={["Stocks initial / final par site", "Totaux livraisons, rajouts, retraits, vols, vidanges", "Consommation considérée", "Onglet GENSET DB (abaque CPH)"]} />
        <Node tone="violet" icon={<FileSpreadsheet />} title="Fichier Output App Fuel (Ops)" lines={["Stock initial (col. O) et final (AM / AQ / AR)", "Totaux de mouvements du mois", "Source du stock : technicien, gardien, estimation Energy Desk"]} />
        <Node tone="cyan" icon={<Truck />} title="ENOC (MongoDB, lecture seule)" lines={["Livraisons, ponctions, rajouts, retraits", "Niveaux avant / après ravitaillement", "Relevés terrain et gardiennage"]} />
        <Node tone="cyan" icon={<Database />} title="Snowflake (lecture seule)" lines={["Temps de marche GE, puissance", "Conso instrumentée (capteurs)", "Capacité des cuves"]} />
      </Column>
      <Arrow />
      <Column label="2 · Traitement EnerTrack" tone="blue">
        <Node tone="blue" icon={<Upload />} title="Import (rubrique Configuration)" lines={["Format détecté automatiquement", "Mois déclaré + contrôle des dates", "Doublons refusés, fichier retirable"]} />
        <Node tone="blue" icon={<Gauge />} title="Choix des stocks" lines={["Stock initial et stock final selon le mois (voir section 2)", "Relevé le plus récent dans la tolérance", "Estimation = toujours « avec réserve »"]} />
        <Node tone="blue" icon={<Calculator />} title="Bilan de stock par site" lines={["Formule unique (voir section 3)", "Score de confiance sur 100", "Arrondi ≤ 1 L ramené à 0 L"]} />
        <Node tone="blue" icon={<Cpu />} title="Références de contrôle" lines={["Conso théorique CPH (abaque GENSET DB)", "Conso Closing / Ops", "Conso instrumentée Snowflake"]} />
      </Column>
      <Arrow />
      <Column label="3 · Sorties (écrans)" tone="green">
        <Node tone="green" icon={<Fuel />} title="Suivis Consommations" lines={["Variation de stock par site", "Écarts vs Closing, CPH, instrumentée, target", "Statut du bilan"]} />
        <Node tone="green" icon={<ShieldCheck />} title="Certification Fuel Manager" lines={["Bilan « Prêt à certifier » → certifié", "Historique non modifiable"]} />
        <Node tone="green" icon={<LayoutDashboard />} title="Dashboard / Stock / Commandes" lines={["Stock final = base de la commande", "Conso / jour = besoin estimé", "Santé des données"]} />
      </Column>
    </div>
  );
}

type Cell = { text: string; src: string; tone: Tone };
const MONTHS: Array<{ mois: string; mode: string; tone: Tone; ini: Cell; mv: Cell; fin: Cell; result: string }> = [
  { mois: "Septembre 2026", mode: "Mois de RÉFÉRENCE", tone: "violet",
    ini: { text: "Ligne du Closing", src: "Closing sept.", tone: "violet" }, mv: { text: "Totaux du Closing", src: "Closing sept.", tone: "violet" },
    fin: { text: "Ligne du Closing", src: "Closing sept.", tone: "violet" }, result: "Affiché TEL QUEL (aucun recalcul) · statut « Référence Closing »" },
  { mois: "Octobre 2026", mode: "Mois CALCULÉ (fichiers)", tone: "blue",
    ini: { text: "Stock initial du fichier", src: "Closing / Output col. O", tone: "violet" }, mv: { text: "Totaux du fichier (font foi)", src: "Output App Fuel", tone: "violet" },
    fin: { text: "Stock retenu (≤ 6 j après fin de mois)", src: "Output col. AM / AQ / AR", tone: "violet" }, result: "Calculé par EnerTrack · avec réserve si estimation ou relevé après la borne" },
  { mois: "Novembre 2026 et suivants", mode: "Mois CALCULÉ (application)", tone: "green",
    ini: { text: "Stock final du mois précédent", src: "EnerTrack", tone: "green" }, mv: { text: "Mouvements qualifiés", src: "ENOC", tone: "cyan" },
    fin: { text: "Relevé le plus récent", src: "ENOC terrain / gardiennage / ravitaillement", tone: "cyan" }, result: "Calculé par EnerTrack · chaînage mois après mois" },
];

function Chip({ c }: { c: Cell }) {
  const t = toneColors(c.tone);
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: FT.radiusSm, padding: "8px 10px", height: "100%" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: FT.text }}>{c.text}</div>
      <div style={{ fontSize: 11, color: t.fg, fontWeight: 700, marginTop: 2 }}>{c.src}</div>
    </div>
  );
}

function MonthRules() {
  const head: CSSProperties = { fontSize: 11, fontWeight: 800, color: FT.textMid, textTransform: "uppercase", letterSpacing: ".05em", padding: "0 4px 6px" };
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "170px repeat(3, minmax(170px, 1fr)) minmax(200px, 1.2fr)", gap: 8, minWidth: 900 }}>
        <div style={head}>Mois</div><div style={head}>Stock initial</div><div style={head}>Mouvements</div><div style={head}>Stock final</div><div style={head}>Résultat</div>
        {MONTHS.map((m) => {
          const t = toneColors(m.tone);
          return [
            <div key={m.mois + "a"} style={{ borderLeft: `4px solid ${t.fg}`, padding: "6px 10px", background: FT.cardAlt, borderRadius: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: FT.text, display: "flex", gap: 6, alignItems: "center" }}><CalendarRange size={14} />{m.mois}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.fg, marginTop: 2 }}>{m.mode}</div>
            </div>,
            <Chip key={m.mois + "b"} c={m.ini} />, <Chip key={m.mois + "c"} c={m.mv} />, <Chip key={m.mois + "d"} c={m.fin} />,
            <div key={m.mois + "e"} style={{ fontSize: 12.5, color: FT.textMid, padding: "8px 10px", border: FT.borderCrisp, borderRadius: FT.radiusSm }}>{m.result}</div>,
          ];
        })}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 12, color: FT.textMid, flexWrap: "wrap" }}>
        <RefreshCw size={14} /> Chaînage : le stock final d'un mois devient le stock initial du mois suivant (septembre → octobre → novembre …).
      </div>
    </div>
  );
}

function Formula() {
  const box = (label: string, tone: Tone, sign?: string) => {
    const t = toneColors(tone);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {sign && <span style={{ fontSize: 22, fontWeight: 800, color: FT.textMid }}>{sign}</span>}
        <span style={{ background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, borderRadius: 8, padding: "8px 12px", fontWeight: 700, fontSize: 13 }}>{label}</span>
      </div>
    );
  };
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {box("Stock initial", "violet")}
        {box("Livraisons (Eydon + Carte Total)", "green", "+")}
        {box("Rajouts / ponctions entrantes", "green", "+")}
        {box("Retraits / ponctions sortantes", "orange", "−")}
        {box("Vols", "red", "−")}
        {box("Vidanges / fuites", "red", "−")}
        {box("Stock final", "violet", "−")}
        <span style={{ fontSize: 22, fontWeight: 800, color: FT.textMid }}>=</span>
        <span style={{ background: FT.navy, color: "#fff", borderRadius: 8, padding: "9px 14px", fontWeight: 800, fontSize: 14 }}>Variation de stock (L)</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 14 }}>
        <Node tone="slate" icon={<CheckCircle2 />} title="Variation ≥ 0" lines={["C'est la consommation du site sur la période", "Comparée au Closing, à la CPH et à l'instrumentée"]} />
        <Node tone="red" icon={<AlertTriangle />} title="Variation < 0 (au-delà de −1 L)" lines={["Anomalie : mouvement manquant ou relevé faux", "Jamais certifiable, à corriger à la source"]} />
        <Node tone="slate" icon={<XCircle />} title="Stock manquant" lines={["Pas de stock initial ou final exploitable", "Bilan « non calculable » (jamais 0 L inventé)"]} />
      </div>
    </div>
  );
}

const STATUS: Array<{ label: string; tone: Tone; text: string }> = [
  { label: "Référence Closing", tone: "blue", text: "Mois de référence : ligne du Closing affichée telle quelle." },
  { label: "Prêt à certifier", tone: "green", text: "Score ≥ 80, aucun point de réserve : le Fuel Manager peut certifier." },
  { label: "Estimation avec réserve", tone: "orange", text: "Score 50–79, stock estimé ou relevé hors borne : à lire avec prudence." },
  { label: "Variation calculée (à contrôler)", tone: "red", text: "Variation négative : anomalie visible, jamais certifiable." },
  { label: "Non calculable", tone: "slate", text: "Stock manquant, trop ancien ou score < 50 : aucune valeur affichée." },
  { label: "Réelle certifiée", tone: "violet", text: "Validée explicitement par le Fuel Manager." },
];

function Statuses() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
      {STATUS.map((s) => {
        const t = toneColors(s.tone);
        return (
          <div key={s.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, border: FT.borderCrisp, borderRadius: FT.radiusSm }}>
            <span style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</span>
            <span style={{ fontSize: 12.5, color: FT.textMid }}>{s.text}</span>
          </div>
        );
      })}
    </div>
  );
}

const STEPS: Array<{ icon: ReactNode; title: string; text: string }> = [
  { icon: <Settings2 />, title: "Configuration", text: "Choisir le fichier (Closing ou Output App Fuel) et le mois qu'il couvre." },
  { icon: <Upload />, title: "Import", text: "Lecture, contrôle des sites, des dates et des capacités ; doublons refusés." },
  { icon: <RefreshCw />, title: "Recalcul immédiat", text: "Bilans du mois couvert et du suivant recalculés, sans attendre la nuit." },
  { icon: <Fuel />, title: "Suivis Consommations", text: "Résultats visibles par site, avec statut et écarts." },
  { icon: <Target />, title: "Contrôle & certification", text: "Audit des écarts, correction à la source, certification Fuel Manager." },
];

function ImportSteps() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "stretch" }}>
      {STEPS.map((s, i) => (
        <div key={s.title} style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 170px" }}>
          <div style={{ ...card, padding: 12, flex: 1, height: "100%" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", color: FT.gold, fontWeight: 700, fontSize: 13 }}>
              <span style={{ display: "inline-flex", width: 16, height: 16 }}>{s.icon}</span>{i + 1}. {s.title}
            </div>
            <div style={{ fontSize: 12, color: FT.textMid, marginTop: 4 }}>{s.text}</div>
          </div>
          {i < STEPS.length - 1 && <ArrowRight size={18} color={FT.textSub} className="doc-arrow" />}
        </div>
      ))}
    </div>
  );
}

export function DocumentationSheet() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <style>{"@media (max-width: 760px){ .doc-arrow{ transform: rotate(90deg); width:100% } }"}</style>
      <div style={{ ...card, padding: "16px 20px", marginBottom: 18, background: FT.headerGrad, color: FT.textOnDark }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Documentation — Suivi Carburant</div>
        <div style={{ fontSize: 13, color: FT.textOnDarkSub, marginTop: 4 }}>
          D'où viennent les données, comment EnerTrack les traite et où les retrouver. Règles en vigueur : bilan-v3-mvp.
        </div>
      </div>
      <Section n={1} title="Vue d'ensemble : des sources aux écrans" sub="Chaque donnée affichée vient d'une source identifiée ; ENOC et Snowflake sont lus, jamais modifiés.">
        <FlowOverview />
      </Section>
      <Section n={2} title="Quelle source pour quel mois ?" sub="Le stock initial, les mouvements et le stock final ne viennent pas de la même source selon le mois.">
        <MonthRules />
      </Section>
      <Section n={3} title="Le calcul du bilan de stock" sub="Une seule formule, appliquée site par site sur la période exacte.">
        <Formula />
      </Section>
      <Section n={4} title="Lire le statut d'un bilan" sub="Le statut indique le niveau de confiance de la valeur affichée.">
        <Statuses />
      </Section>
      <Section n={5} title="Du fichier importé au résultat" sub="Ce qui se passe quand un fichier est importé dans la rubrique Configuration.">
        <ImportSteps />
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12, fontSize: 12, color: FT.textMid }}>
          <ArrowDown size={14} /> Retirer un fichier supprime ses données et recalcule les mois concernés.
        </div>
      </Section>
    </div>
  );
}
