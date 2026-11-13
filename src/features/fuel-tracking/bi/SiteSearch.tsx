// Recherche d'un site (identifiant ou nom) — ouvre la fiche site. Combobox accessible au clavier.
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { searchBiSites } from "@/services/fuelTracking";
import { FT } from "../theme";

export function SiteSearch({ onSelect }: { onSelect: (siteId: string) => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const r = useQuery({ queryKey: ["fuel-bi-site-search", q], queryFn: () => searchBiSites(q), enabled: q.length >= 2, staleTime: 60_000 });
  const hits = q.length >= 2 ? r.data ?? [] : [];
  const pick = (id: string) => { onSelect(id); setOpen(false); setText(""); setQ(""); };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: "#fff", borderRadius: 9, padding: "5px 9px", width: 230 }}>
        <Search size={14} color={FT.textSub} aria-hidden />
        <input
          role="combobox" aria-expanded={open && q.length >= 2} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
          aria-label="Rechercher un site" placeholder="Rechercher un site…" value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && hits[active]) { e.preventDefault(); pick(hits[active].site_id); }
            else if (e.key === "Escape") setOpen(false);
          }}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, width: "100%" }}
        />
        {text && <button type="button" aria-label="Effacer" onClick={() => { setText(""); setQ(""); }} style={{ all: "unset", cursor: "pointer", display: "grid" }}><X size={13} color={FT.textSub} /></button>}
      </div>
      {open && text.trim().length >= 2 && (
        <div id={listId} role="listbox" style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, width: "min(340px, calc(100vw - 32px))", maxHeight: 340, overflowY: "auto", zIndex: 30,
          background: "#fff", border: `1px solid ${FT.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(11,31,77,.14)", padding: 4,
        }}>
          {r.isFetching && !hits.length ? <div style={{ padding: 10, fontSize: 12.5, color: FT.textSub }}>Recherche…</div>
            : r.isError ? <div role="alert" style={{ padding: 10, fontSize: 12.5, color: FT.red }}>Recherche indisponible.</div>
            : !hits.length ? <div style={{ padding: 10, fontSize: 12.5, color: FT.textSub }}>Aucun site du Sénégal ne correspond.</div>
            : hits.map((h, i) => (
              <div key={h.site_id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(h.site_id); }}
                style={{ padding: "7px 9px", borderRadius: 6, cursor: "pointer", background: i === active ? "#EEF3FB" : undefined, display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, color: FT.navy, fontSize: 12.5 }}>{h.site_id}</span>
                <span style={{ fontSize: 12, color: FT.textMid, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.site_name ?? ""}</span>
                <span style={{ fontSize: 11, color: FT.textSub }}>{[h.zone, h.has_genset ? null : "sans GE"].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
