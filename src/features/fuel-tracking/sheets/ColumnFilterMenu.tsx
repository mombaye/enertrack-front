// src/features/fuel-tracking/sheets/ColumnFilterMenu.tsx
// Filtre de colonne « comme Excel » (bouton ▼ de chaque en-tête du tableau Suivi Conso) : liste des valeurs de la colonne
// avec leur nombre de sites, recherche, « Sélectionner tout », OK / Annuler. Les valeurs viennent du serveur (tous les
// sites du filtre, pas seulement la page) ; « (Vides) » = case n.d., jamais confondue avec 0.
// Comme sur Excel : la fenêtre s'ouvre juste SOUS l'en-tête cliqué, par-dessus le tableau, sans jamais le faire défiler
// (rendue dans <body>, focus sans défilement) ; elle se ferme si la page ou le tableau défile.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ColValue = { valeur: string; nb: number };

const NUM = /^-?\d+(\.\d+)?$/;
const ISO = /^\d{4}-\d{2}-\d{2}/;
export const valueLabel = (v: string) => {
  if (v === "") return "(Vides)";
  if (NUM.test(v)) return Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  if (ISO.test(v) && v.length <= 10) return v.slice(0, 10).split("-").reverse().join("/");
  return v;
};

export function ColumnFilterMenu({ title, anchor, selected, load, onApply, onClose }: {
  title: string;
  anchor: DOMRect;
  selected: string[] | undefined;                 // filtre actif (undefined = aucun)
  load: () => Promise<ColValue[]>;
  onApply: (values: string[] | null) => void;     // null = retirer le filtre
  onClose: () => void;
}) {
  const [values, setValues] = useState<ColValue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { search.current?.focus({ preventScroll: true }); }, []);   // focus sans faire défiler le tableau

  useEffect(() => {
    let alive = true;
    load().then((v) => {
      if (!alive) return;
      setValues(v);
      setChecked(new Set(selected ?? v.map((x) => x.valeur)));
    }).catch(() => alive && setError("Valeurs indisponibles. Réessayez."));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    // la page ou le tableau défile : l'en-tête bouge, la fenêtre se ferme (comme Excel) ; défilement de la liste : rien
    const scroll = (e: Event) => { if (!(ref.current && e.target instanceof Node && ref.current.contains(e.target))) onClose(); };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click);
      window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const shown = useMemo(() => (values ?? []).filter((v) => valueLabel(v.valeur).toLowerCase().includes(q.trim().toLowerCase())), [values, q]);
  const allShown = shown.length > 0 && shown.every((v) => checked.has(v.valeur));
  const toggle = (v: string) => setChecked((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const toggleAll = () => setChecked((s) => { const n = new Set(s); shown.forEach((v) => (allShown ? n.delete(v.valeur) : n.add(v.valeur))); return n; });
  const apply = () => {
    if (!values) return;
    // recherche saisie : comme Excel, seules les valeurs trouvées et cochées sont gardées
    const keep = q.trim() ? shown.filter((v) => checked.has(v.valeur)).map((v) => v.valeur) : values.filter((v) => checked.has(v.valeur)).map((v) => v.valeur);
    onApply(!q.trim() && keep.length === values.length ? null : keep);
  };

  // Juste sous l'en-tête ; la liste raccourcit pour tenir dans l'écran. Seulement si l'en-tête touche le bas de l'écran
  // (moins de LIST_MIN px de liste possibles dessous) : ouverture collée au-dessus de l'en-tête, jamais au milieu de la page.
  const W = 280, CHROME = 135, LIST_MAX = 220, LIST_MIN = 90, M = 8;
  const left = Math.max(M, Math.min(anchor.left, window.innerWidth - W - M));
  const below = window.innerHeight - anchor.bottom - 2 - M - CHROME;
  const up = below < LIST_MIN && anchor.top - M - CHROME > below;
  const listH = Math.max(60, Math.min(LIST_MAX, up ? anchor.top - 2 - M - CHROME : below));
  const pos = up ? { bottom: window.innerHeight - anchor.top + 2 } : { top: anchor.bottom + 2 };
  return createPortal(
    <div ref={ref} role="dialog" aria-label={`Filtrer : ${title}`}
      style={{ position: "fixed", left, ...pos, width: W, zIndex: 1000, background: "#fff", border: "1px solid #C9D3E3", borderRadius: 10,
        boxShadow: "0 10px 30px rgba(15,30,60,.18)", padding: 10, display: "grid", gap: 8, fontSize: 12.5, color: "#1B2433", textAlign: "left",
        fontWeight: 500, textTransform: "none", whiteSpace: "normal" }}>
      <div style={{ fontWeight: 800, fontSize: 12 }}>{title}</div>
      <input ref={search} aria-label="Rechercher une valeur" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)}
        style={{ fontSize: 12.5, padding: "6px 8px", border: "1px solid #C9D3E3", borderRadius: 7 }} />
      <div style={{ maxHeight: listH, overflow: "auto", overscrollBehavior: "contain", border: "1px solid #E3E8F0", borderRadius: 7, padding: "4px 6px" }}>
        {error ? <div style={{ color: "#B42318", padding: 6 }}>{error}</div>
          : !values ? <div style={{ color: "#6B7A90", padding: 6 }}>Chargement…</div>
          : shown.length === 0 ? <div style={{ color: "#6B7A90", padding: 6 }}>Aucune valeur.</div>
          : (
            <>
              <label style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 0", fontWeight: 700 }}>
                <input type="checkbox" checked={allShown} onChange={toggleAll} /> (Sélectionner tout)
              </label>
              {shown.map((v) => (
                <label key={v.valeur} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 0" }}>
                  <input type="checkbox" checked={checked.has(v.valeur)} onChange={() => toggle(v.valeur)} />
                  <span style={{ flex: 1, color: v.valeur === "" ? "#6B7A90" : undefined, overflowWrap: "anywhere" }}>{valueLabel(v.valeur)}</span>
                  <span style={{ color: "#6B7A90", fontVariantNumeric: "tabular-nums" }}>{v.nb}</span>
                </label>
              ))}
            </>
          )}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
        <button type="button" onClick={() => onApply(null)} disabled={!selected}
          style={{ fontSize: 12, padding: "6px 8px", border: "none", background: "none", color: selected ? "#1F5FBF" : "#A0AABA", cursor: selected ? "pointer" : "default", fontWeight: 700 }}>
          Effacer le filtre
        </button>
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "1px solid #C9D3E3", background: "#fff", cursor: "pointer" }}>Annuler</button>
          <button type="button" onClick={apply} disabled={!values || checked.size === 0}
            style={{ fontSize: 12, padding: "6px 12px", borderRadius: 7, border: "none", background: "#1F3864", color: "#fff", fontWeight: 800,
              cursor: values && checked.size ? "pointer" : "not-allowed", opacity: values && checked.size ? 1 : 0.5 }}>OK</button>
        </span>
      </div>
    </div>,
    document.body,
  );
}
