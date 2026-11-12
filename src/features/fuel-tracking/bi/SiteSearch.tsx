// Recherche d'un site (identifiant ou nom) avec autocomplétion — ouvre la fiche site. Combobox accessible au clavier.
// Suggestions pendant la frappe (le serveur répond à partir de 2 caractères), partie saisie surlignée,
// derniers sites consultés proposés dès le clic dans le champ (mémorisés dans ce navigateur uniquement).
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Clock, Search, X } from "lucide-react";
import { searchBiSites, type BiSiteHit } from "@/services/fuelTracking";
import { FT } from "../theme";

const RECENT_KEY = "fuel-recent-sites";
type Recent = { site_id: string; site_name: string | null };

function readRecent(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(r: Recent) {
  try {
    const next = [r, ...readRecent().filter((x) => x.site_id !== r.site_id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : pas d'historique, la recherche fonctionne quand même */
  }
}

/** Surligne la partie saisie (sans tenir compte de la casse ni des accents). */
function Mark({ text, q }: { text: string; q: string }): ReactNode {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const i = q ? norm(text).indexOf(norm(q)) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: "#FFF1B8", color: "inherit", borderRadius: 2, padding: 0 }}>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SiteSearch({ onSelect }: { onSelect: (siteId: string) => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Recent[]>(() => readRecent());
  const boxRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const typed = text.trim();

  useEffect(() => {
    const t = setTimeout(() => setQ(typed), 120);
    return () => clearTimeout(t);
  }, [typed]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const r = useQuery({
    queryKey: ["fuel-bi-site-search", q],
    queryFn: () => searchBiSites(q),
    enabled: q.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData, // la liste reste affichée pendant la frappe, pas de clignotement
  });
  const searching = typed.length >= 2;
  const hits: Array<BiSiteHit | Recent> = searching ? r.data ?? [] : typed.length === 0 ? recent : [];
  const showList = open && (searching || typed.length === 1 || (typed.length === 0 && recent.length > 0));

  const pick = (h: BiSiteHit | Recent) => {
    pushRecent({ site_id: h.site_id, site_name: h.site_name ?? null });
    setRecent(readRecent());
    onSelect(h.site_id);
    setOpen(false);
    setText("");
    setQ("");
  };

  const row = (h: BiSiteHit | Recent, i: number) => {
    const full = "zone" in h ? h : null;
    return (
      <div key={h.site_id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
        onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(h); }}
        style={{ padding: "7px 9px", borderRadius: 6, cursor: "pointer", background: i === active ? "#EEF3FB" : undefined, display: "flex", gap: 10, alignItems: "baseline" }}>
        {!searching && <Clock size={12} color={FT.textSub} aria-hidden style={{ flexShrink: 0, alignSelf: "center" }} />}
        <span style={{ fontWeight: 600, color: FT.text, fontSize: 12.5, whiteSpace: "nowrap" }}><Mark text={h.site_id} q={searching ? typed : ""} /></span>
        <span style={{ fontSize: 12, color: FT.textMid, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Mark text={h.site_name ?? ""} q={searching ? typed : ""} />
        </span>
        {full && <span style={{ fontSize: 11, color: FT.textSub, whiteSpace: "nowrap" }}>{[full.zone, full.has_genset ? null : "sans GE"].filter(Boolean).join(" · ")}</span>}
      </div>
    );
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: "#fff", borderRadius: 9, padding: "5px 9px", width: 230 }}>
        <Search size={14} color={FT.textSub} aria-hidden />
        <input
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
          aria-label="Rechercher un site" placeholder="Rechercher un site…" value={text} autoComplete="off" spellCheck={false}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => { setRecent(readRecent()); setOpen(true); }}
          onClick={() => { setRecent(readRecent()); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if ((e.key === "Enter" || (e.key === "Tab" && searching)) && showList && hits[active]) { e.preventDefault(); pick(hits[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, width: "100%" }}
        />
        {text && <button type="button" aria-label="Effacer" onClick={() => { setText(""); setQ(""); }} style={{ all: "unset", cursor: "pointer", display: "grid" }}><X size={13} color={FT.textSub} /></button>}
      </div>
      {showList && (
        <div id={listId} role="listbox" aria-label="Sites proposés" style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, width: "min(360px, calc(100vw - 32px))", maxHeight: 340, overflowY: "auto", zIndex: 30,
          background: "#fff", border: `1px solid ${FT.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(11,31,77,.14)", padding: 4,
        }}>
          {typed.length === 1 ? <div style={{ padding: 10, fontSize: 12.5, color: FT.textSub }}>Encore 1 caractère pour voir les sites…</div>
            : !searching ? (
              <>
                <div style={{ padding: "6px 9px 4px", fontSize: 11, color: FT.textSub }}>Derniers sites consultés</div>
                {hits.map(row)}
              </>
            )
            : r.isError ? <div role="alert" style={{ padding: 10, fontSize: 12.5, color: FT.red }}>Recherche indisponible.</div>
            : r.isPending ? <div style={{ padding: 10, fontSize: 12.5, color: FT.textSub }}>Recherche…</div>
            : !hits.length ? <div style={{ padding: 10, fontSize: 12.5, color: FT.textSub }}>{r.isFetching ? "Recherche…" : "Aucun site du Sénégal ne correspond."}</div>
            : hits.map(row)}
        </div>
      )}
    </div>
  );
}
