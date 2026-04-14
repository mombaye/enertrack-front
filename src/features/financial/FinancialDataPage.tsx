
import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchMonthlyLoads,
  updateMonthlyLoad,
  importMonthlyLoads,
  fetchFeeRules,
  importFeeRules,
  evaluateFinancialRange,
  type SiteMonthlyLoad,
  type FinancialFeeRule,
} from "./api";
import {
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  X,
  Loader2,
  FileUp,
  RefreshCw,
  Layers,
  Database,
  Info,
  Wand2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Août","Sep","Oct","Nov","Déc"];

function Badge({ children, color }: { children: React.ReactNode; color: "blue"|"orange"|"green"|"gray" }) {
  const styles: Record<string, React.CSSProperties> = {
    blue:   { background:"rgba(30,58,138,.08)", color:"#1e3a8a", border:"1px solid rgba(30,58,138,.12)" },
    orange: { background:"rgba(232,64,28,.08)", color:"#c2410c", border:"1px solid rgba(232,64,28,.12)" },
    green:  { background:"rgba(5,150,105,.08)", color:"#059669", border:"1px solid rgba(5,150,105,.12)" },
    gray:   { background:"rgba(0,0,0,.05)",     color:"#64748b", border:"1px solid rgba(0,0,0,.08)" },
  };
  return (
    <span style={{
      ...styles[color], fontSize:10.5, fontWeight:700,
      padding:"2px 8px", borderRadius:100, whiteSpace:"nowrap",
    }}>
      {children}
    </span>
  );
}

// ─── Upload modal ──────────────────────────────────────────────────────────────
function UploadModal({
  title, description, accept = ".xlsx,.xls,.csv", onClose, onUpload,
}: {
  title: string; description: string; accept?: string;
  onClose: () => void;
  onUpload: (file: File) => Promise<any>;
}) {
  const [file, setFile]       = useState<File|null>(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<any>(null);
  const [error,   setError]   = useState<string|null>(null);
  const [drag,    setDrag]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try { setResult(await onUpload(file)); }
    catch (e: any) { setError(e?.response?.data?.detail || e?.message || "Erreur."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.6)",
      backdropFilter:"blur(8px)", display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}
      onClick={e => e.target===e.currentTarget && !loading && onClose()}>
      <div style={{ background:"white",borderRadius:22,padding:30,maxWidth:440,width:"100%",
        boxShadow:"0 32px 80px rgba(0,0,0,.2)", animation:"slideUp .2s cubic-bezier(.34,1.4,.64,1)" }}>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18 }}>
          <div>
            <h3 style={{ fontSize:15,fontWeight:700,color:"#0f172a",margin:"0 0 3px" }}>{title}</h3>
            <p style={{ fontSize:12,color:"#64748b",margin:0 }}>{description}</p>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ background:"rgba(0,0,0,.06)",border:"none",
              borderRadius:8,padding:6,cursor:"pointer",color:"#64748b",display:"grid",placeItems:"center" }}>
              <X size={14}/>
            </button>
          )}
        </div>

        {!result ? (<>
          <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);e.dataTransfer.files[0]&&setFile(e.dataTransfer.files[0])}}
            onClick={()=>inputRef.current?.click()}
            style={{ border:`2px dashed ${drag?"#1e3a8a":file?"rgba(5,150,105,.4)":"rgba(30,58,138,.18)"}`,
              borderRadius:14,padding:"24px 20px",textAlign:"center",cursor:"pointer",marginBottom:14,
              background:drag?"rgba(30,58,138,.03)":file?"rgba(5,150,105,.03)":"rgba(248,250,252,1)",
              transition:"all .18s" }}>
            <input ref={inputRef} type="file" accept={accept} style={{display:"none"}}
              onChange={e=>e.target.files?.[0]&&setFile(e.target.files[0])}/>
            <FileUp size={26} color={file?"#059669":"#94a3b8"} style={{marginBottom:8}}/>
            {file ? (
              <div>
                <p style={{fontSize:12.5,fontWeight:600,color:"#059669",margin:"0 0 2px"}}>{file.name}</p>
                <p style={{fontSize:11,color:"#94a3b8",margin:0}}>{(file.size/1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p style={{fontSize:12.5,fontWeight:600,color:"#374151",margin:"0 0 2px"}}>
                  Glisser-déposer ou cliquer
                </p>
                <p style={{fontSize:11,color:"#94a3b8",margin:0}}>{accept}</p>
              </div>
            )}
          </div>
          {error && (
            <div style={{padding:"9px 13px",borderRadius:11,background:"rgba(220,38,38,.07)",
              border:"1px solid rgba(220,38,38,.15)",fontSize:12,color:"#dc2626",marginBottom:12}}>
              ⚠ {error}
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={{flex:1,padding:"9px 0",borderRadius:10,
              border:"1.5px solid rgba(0,0,0,.1)",background:"white",
              fontSize:12.5,fontWeight:600,color:"#374151",cursor:"pointer"}}>Annuler</button>
            <button disabled={!file||loading} onClick={submit} style={{flex:2,padding:"9px 0",
              borderRadius:10,border:"none",
              background:file&&!loading?"linear-gradient(135deg,#1e3a8a,#2d52b8)":"rgba(30,58,138,.25)",
              fontSize:12.5,fontWeight:600,color:"white",cursor:file&&!loading?"pointer":"not-allowed",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {loading&&<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>}
              {loading?"Import en cours…":"Importer"}
            </button>
          </div>
        </>) : (
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:8}}>✅</div>
            <h4 style={{fontSize:14,fontWeight:700,color:"#0f172a",margin:"0 0 6px"}}>Import terminé</h4>
            {result.periode_couverte && (
              <p style={{fontSize:12,color:"#64748b",margin:"0 0 12px"}}>
                Période : <strong>{result.periode_couverte}</strong>
              </p>
            )}
            <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:16}}>
              {[
                {label:"Créés",value:result.created,color:"#059669"},
                {label:"Mis à jour",value:result.updated,color:"#0891b2"},
                {label:"Ignorés",value:result.skipped||result.skipped_sites_inconnus||0,color:"#f59e0b"},
              ].map(s=>(
                <div key={s.label} style={{padding:"9px 14px",borderRadius:11,
                  background:"rgba(0,0,0,.03)",border:"1px solid rgba(0,0,0,.06)"}}>
                  <div style={{fontSize:18,fontWeight:800,color:s.color,fontFamily:"'Outfit',sans-serif"}}>
                    {s.value}
                  </div>
                  <div style={{fontSize:10.5,fontWeight:600,color:"#94a3b8"}}>{s.label}</div>
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{width:"100%",padding:"9px 0",borderRadius:10,border:"none",
              background:"linear-gradient(135deg,#1e3a8a,#2d52b8)",
              fontSize:12.5,fontWeight:600,color:"white",cursor:"pointer"}}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}


function EvaluateLoadsModal({
  onClose,
  onDone,
  initialYear,
  initialMonth,
}: {
  onClose: () => void;
  onDone: () => void;
  initialYear?: number | "";
  initialMonth?: number | "";
}) {
  const [mode, setMode] = useState<"single" | "range">(initialMonth ? "single" : "range");
  const [year, setYear] = useState<number | "">(initialYear || new Date().getFullYear());
  const [month, setMonth] = useState<number | "">(initialMonth || "");
  const [monthStart, setMonthStart] = useState<number | "">(1);
  const [monthEnd, setMonthEnd] = useState<number | "">(12);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!year) {
      setError("Choisis une année.");
      return;
    }

    if (mode === "single" && !month) {
      setError("Choisis un mois.");
      return;
    }

    if (mode === "range" && (!monthStart || !monthEnd)) {
      setError("Choisis une plage de mois.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await evaluateFinancialRange({
        year: Number(year),
        month: mode === "single" ? Number(month) : undefined,
        month_start: mode === "range" ? Number(monthStart) : undefined,
        month_end: mode === "range" ? Number(monthEnd) : undefined,
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Erreur pendant le recalcul.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 450,
        background: "rgba(15,23,42,.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div
        style={{
          background: "white",
          borderRadius: 22,
          padding: 30,
          maxWidth: 520,
          width: "100%",
          boxShadow: "0 32px 80px rgba(0,0,0,.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 3px" }}>
              Mettre à jour les stats financières
            </h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              Recalcule les évaluations financières à partir des loads mensuels.
            </p>
          </div>

          {!loading && (
            <button
              onClick={onClose}
              style={{
                background: "rgba(0,0,0,.06)",
                border: "none",
                borderRadius: 8,
                padding: 6,
                cursor: "pointer",
                color: "#64748b",
                display: "grid",
                placeItems: "center",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {!result ? (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => setMode("single")}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 10,
                  border: `1.5px solid ${mode === "single" ? "#1e3a8a" : "rgba(0,0,0,.1)"}`,
                  background: mode === "single" ? "rgba(30,58,138,.06)" : "white",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: mode === "single" ? "#1e3a8a" : "#374151",
                  cursor: "pointer",
                }}
              >
                Un mois
              </button>
              <button
                onClick={() => setMode("range")}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 10,
                  border: `1.5px solid ${mode === "range" ? "#1e3a8a" : "rgba(0,0,0,.1)"}`,
                  background: mode === "range" ? "rgba(30,58,138,.06)" : "white",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: mode === "range" ? "#1e3a8a" : "#374151",
                  cursor: "pointer",
                }}
              >
                Une plage
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                  Année
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: "1.5px solid rgba(0,0,0,.09)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "white",
                    outline: "none",
                  }}
                >
                  <option value="">Choisir</option>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {mode === "single" ? (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                    Mois
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 10,
                      border: "1.5px solid rgba(0,0,0,.09)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#0f172a",
                      background: "white",
                      outline: "none",
                    }}
                  >
                    <option value="">Choisir</option>
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                      Début
                    </label>
                    <select
                      value={monthStart}
                      onChange={(e) => setMonthStart(e.target.value ? Number(e.target.value) : "")}
                      style={{
                        width: "100%",
                        padding: "9px 10px",
                        borderRadius: 10,
                        border: "1.5px solid rgba(0,0,0,.09)",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#0f172a",
                        background: "white",
                        outline: "none",
                      }}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                      Fin
                    </label>
                    <select
                      value={monthEnd}
                      onChange={(e) => setMonthEnd(e.target.value ? Number(e.target.value) : "")}
                      style={{
                        width: "100%",
                        padding: "9px 10px",
                        borderRadius: 10,
                        border: "1.5px solid rgba(0,0,0,.09)",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#0f172a",
                        background: "white",
                        outline: "none",
                      }}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: "10px 12px",
                borderRadius: 11,
                background: "rgba(30,58,138,.05)",
                border: "1px solid rgba(30,58,138,.1)",
                fontSize: 12,
                color: "#374151",
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              Cette action recalcule les marges, statuts, périodes courtes et récurrences NOK pour toute la période choisie.
            </div>

            {error && (
              <div
                style={{
                  padding: "9px 13px",
                  borderRadius: 11,
                  background: "rgba(220,38,38,.07)",
                  border: "1px solid rgba(220,38,38,.15)",
                  fontSize: 12,
                  color: "#dc2626",
                  marginBottom: 12,
                }}
              >
                ⚠ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 10,
                  border: "1.5px solid rgba(0,0,0,.1)",
                  background: "white",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Annuler
              </button>

              <button
                disabled={loading}
                onClick={submit}
                style={{
                  flex: 2,
                  padding: "9px 0",
                  borderRadius: 10,
                  border: "none",
                  background: loading
                    ? "rgba(30,58,138,.25)"
                    : "linear-gradient(135deg,#1e3a8a,#2d52b8)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                {loading ? "Mise à jour en cours…" : "Appliquer"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
              Mise à jour terminée
            </h4>

            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
              {result.mode === "single"
                ? "Recalcul d’un mois terminé."
                : `Recalcul terminé sur ${result.processed_months} mois.`}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Traités", value: result.totals.processed, color: "#1e3a8a" },
                { label: "OK", value: result.totals.ok, color: "#059669" },
                { label: "NOK", value: result.totals.nok, color: "#dc2626" },
                { label: "P. courte", value: result.totals.periode_courte, color: "#c2410c" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: "9px 10px",
                    borderRadius: 11,
                    background: "rgba(0,0,0,.03)",
                    border: "1px solid rgba(0,0,0,.06)",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94a3b8" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {result.months.map((m: any) => (
                <span
                  key={m.month}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#1e3a8a",
                    background: "rgba(30,58,138,.07)",
                    border: "1px solid rgba(30,58,138,.12)",
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  {MONTHS[m.month - 1]} · {m.ok} OK / {m.nok} NOK
                </span>
              ))}
            </div>

            <button
              onClick={() => {
                onDone();
                onClose();
              }}
              style={{
                width: "100%",
                padding: "9px 0",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg,#1e3a8a,#2d52b8)",
                fontSize: 12.5,
                fontWeight: 600,
                color: "white",
                cursor: "pointer",
              }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Inline load editor ────────────────────────────────────────────────────────
function InlineEdit({ load, onSaved }: { load: SiteMonthlyLoad; onSaved: (updated: SiteMonthlyLoad) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(String(load.load_w));
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const n = parseInt(val);
    if (isNaN(n) || n <= 0) { setErr(true); return; }
    setSaving(true);
    try {
      const updated = await updateMonthlyLoad(load.id, n);
      onSaved(updated);
      setEditing(false);
    } catch { setErr(true); }
    finally { setSaving(false); }
  };

  const cancel = () => { setVal(String(load.load_w)); setEditing(false); setErr(false); };

  useEffect(() => { if (editing) setTimeout(()=>inputRef.current?.focus(),50); }, [editing]);

  if (!editing) return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:12.5,fontWeight:600,color:"#0f172a"}}>
        {load.load_w.toLocaleString("fr-FR")} W
      </span>
      {load.source === "import" ? (
        <Badge color="blue">aligné</Badge>
      ) : (
        <Badge color="orange">manuel</Badge>
      )}
      <button onClick={()=>setEditing(true)}
        title="Modifier le load"
        style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",
          display:"grid",placeItems:"center",padding:2,transition:"color .15s"}}
        onMouseEnter={e=>(e.currentTarget.style.color="#1e3a8a")}
        onMouseLeave={e=>(e.currentTarget.style.color="#94a3b8")}>
        <Edit3 size={13}/>
      </button>
    </div>
  );

  return (
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <input
        ref={inputRef}
        type="number"
        value={val}
        onChange={e=>{setVal(e.target.value);setErr(false);}}
        onKeyDown={e=>{ if(e.key==="Enter") save(); if(e.key==="Escape") cancel(); }}
        style={{width:80,padding:"3px 7px",borderRadius:8,
          border:`1.5px solid ${err?"#ef4444":"#1e3a8a"}`,
          fontSize:12.5,fontWeight:600,color:"#0f172a",outline:"none"}}
      />
      <span style={{fontSize:11,color:"#94a3b8"}}>W</span>
      <button onClick={save} disabled={saving}
        style={{background:"#059669",border:"none",borderRadius:7,padding:"4px 6px",
          cursor:"pointer",color:"white",display:"grid",placeItems:"center"}}>
        {saving ? <Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/> : <Check size={12}/>}
      </button>
      <button onClick={cancel}
        style={{background:"rgba(0,0,0,.07)",border:"none",borderRadius:7,padding:"4px 6px",
          cursor:"pointer",color:"#64748b",display:"grid",placeItems:"center"}}>
        <X size={12}/>
      </button>
    </div>
  );
}

// ─── Loads tab ─────────────────────────────────────────────────────────────────
function LoadsTab({
  onImport,
  onEvaluate,
}: {
  onImport: () => void;
  onEvaluate: (initial: { year?: number | ""; month?: number | "" }) => void;
}) {
  const [data,    setData]    = useState<SiteMonthlyLoad[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search,  setSearch]  = useState("");
  const [year,    setYear]    = useState<number|"">(new Date().getFullYear());
  const [month,   setMonth]   = useState<number|"">("");
  const [source,  setSource]  = useState<""|"import"|"manual">("");
  const [page,    setPage]    = useState(1);

  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMonthlyLoads({
        search: search || undefined,
        year:   year   || undefined,
        month:  month  || undefined,
        source: source || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setData(res.results);
      setTotal(res.count);
      setPages(res.pages);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, year, month, source, page]);

  useEffect(() => { setPage(1); }, [search, year, month, source]);
  useEffect(() => { load(); }, [load]);

  const handleSaved = (updated: SiteMonthlyLoad) => {
    setData(d => d.map(o => o.id === updated.id ? updated : o));
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {/* Search */}
        <div style={{position:"relative",flex:"1",minWidth:180}}>
          <Search size={13} color="#94a3b8" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}/>
          <input value={search} onChange={e=>{setSearch(e.target.value)}}
            placeholder="Rechercher un site…"
            style={{width:"100%",padding:"7px 10px 7px 30px",borderRadius:10,
              border:"1.5px solid rgba(0,0,0,.09)",outline:"none",fontSize:12.5,
              color:"#0f172a",background:"white",boxSizing:"border-box"}}/>
        </div>

        {/* Year */}
        <select value={year} onChange={e=>setYear(e.target.value?Number(e.target.value):"")}
          style={{padding:"7px 10px",borderRadius:10,border:"1.5px solid rgba(0,0,0,.09)",
            fontSize:12.5,fontWeight:600,color:"#0f172a",background:"white",outline:"none"}}>
          <option value="">Toutes les années</option>
          {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
        </select>

        {/* Month */}
        <select value={month} onChange={e=>setMonth(e.target.value?Number(e.target.value):"")}
          style={{padding:"7px 10px",borderRadius:10,border:"1.5px solid rgba(0,0,0,.09)",
            fontSize:12.5,fontWeight:600,color:"#0f172a",background:"white",outline:"none"}}>
          <option value="">Tous les mois</option>
          {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
        </select>

        {/* Source */}
        <select value={source} onChange={e=>setSource(e.target.value as any)}
          style={{padding:"7px 10px",borderRadius:10,border:"1.5px solid rgba(0,0,0,.09)",
            fontSize:12.5,fontWeight:600,color:"#0f172a",background:"white",outline:"none"}}>
          <option value="">Toutes les sources</option>
          <option value="import">Alignés (import)</option>
          <option value="manual">Prévisionnels (modifiés)</option>
        </select>

        {/* Refresh */}
        <button onClick={load} style={{padding:"7px 10px",borderRadius:10,
          border:"1.5px solid rgba(0,0,0,.09)",background:"white",cursor:"pointer",
          color:"#64748b",display:"grid",placeItems:"center"}}>
          <RefreshCw size={14} style={loading?{animation:"spin 1s linear infinite"}:{}}/>

        </button>

        <button
          onClick={() => onEvaluate({ year, month })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 10,
            border: "1.5px solid rgba(30,58,138,.15)",
            background: "white",
            color: "#1e3a8a",
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          <Wand2 size={13} />
          Mettre à jour stats
        </button>


        {/* Import */}
        <button onClick={onImport}
          style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",
            borderRadius:10,border:"none",
            background:"linear-gradient(135deg,#1e3a8a,#2d52b8)",
            color:"white",cursor:"pointer",fontSize:12.5,fontWeight:600,
            boxShadow:"0 3px 10px rgba(30,58,138,.2)"}}>
          <Upload size={13}/> Importer loads
        </button>
      </div>

      {/* Info banner */}
      <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"9px 13px",
        borderRadius:11,background:"rgba(30,58,138,.05)",border:"1px solid rgba(30,58,138,.1)",
        marginBottom:14,fontSize:12,color:"#374151",lineHeight:1.5}}>
        <Info size={14} color="#1e3a8a" style={{flexShrink:0,marginTop:1}}/>
        <span>
          Les loads <Badge color="blue">alignés</Badge> proviennent du fichier <strong>Load_SNTL_CMST</strong> (officiel Sénélec).
          Les loads <Badge color="orange">prévisionnels</Badge> viennent des fichiers <strong>Proposition</strong> — ils peuvent être corrigés manuellement.
          Cliquez sur <Edit3 size={11} style={{display:"inline",verticalAlign:"middle"}}/> pour modifier une valeur.
        </span>
      </div>

      {/* Table */}
      <div style={{borderRadius:14,border:"1.5px solid rgba(0,0,0,.07)",overflow:"hidden",background:"white"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
          <thead>
            <tr style={{background:"rgba(30,58,138,.04)",borderBottom:"1.5px solid rgba(0,0,0,.07)"}}>
              {["Site ID","Nom du site","Mois","Année","Load","Source"].map(h=>(
                <th key={h} style={{padding:"9px 14px",textAlign:"left",
                  fontWeight:700,color:"#374151",fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !data.length ? (
              <tr><td colSpan={6} style={{padding:"32px 0",textAlign:"center",color:"#94a3b8"}}>
                <Loader2 size={20} style={{animation:"spin 1s linear infinite",marginBottom:6,display:"block",margin:"0 auto 6px"}}/>
                <div style={{fontSize:12.5}}>Chargement…</div>
              </td></tr>
            ) : !data.length ? (
              <tr><td colSpan={6} style={{padding:"32px 0",textAlign:"center",color:"#94a3b8",fontSize:13}}>
                Aucun load trouvé
              </td></tr>
            ) : data.map((o,i)=>(
              <tr key={o.id} style={{borderBottom:"1px solid rgba(0,0,0,.05)",
                background:i%2===0?"white":"rgba(248,250,252,.6)"}}>
                <td style={{padding:"9px 14px",fontWeight:700,color:"#1e3a8a"}}>{o.site_id}</td>
                <td style={{padding:"9px 14px",color:"#374151",maxWidth:160,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.site_name}</td>
                <td style={{padding:"9px 14px",color:"#374151",fontWeight:600}}>
                  {MONTHS[(o.month||1)-1]}
                </td>
                <td style={{padding:"9px 14px",color:"#374151"}}>{o.year}</td>
                <td style={{padding:"9px 14px"}}>
                  <InlineEdit load={o} onSaved={handleSaved}/>
                </td>
                <td style={{padding:"9px 14px"}}>
                  {o.source==="import"
                    ? <Badge color="blue">aligné</Badge>
                    : <Badge color="orange">modifié</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          marginTop:14,flexWrap:"wrap",gap:10}}>
          <span style={{fontSize:12,color:"#64748b"}}>
            {total.toLocaleString("fr-FR")} résultats — page {page}/{pages}
          </span>
          <div style={{display:"flex",gap:6}}>
            <button disabled={page<=1} onClick={()=>setPage(p=>p-1)}
              style={{padding:"6px 10px",borderRadius:9,border:"1.5px solid rgba(0,0,0,.1)",
                background:"white",cursor:page<=1?"not-allowed":"pointer",
                color:page<=1?"#d1d5db":"#374151",display:"flex",alignItems:"center",gap:4,fontSize:12.5}}>
              <ChevronLeft size={13}/> Préc.
            </button>
            {/* Page numbers */}
            {Array.from({length:Math.min(7,pages)},(_,i)=>{
              const p = page<=4?i+1:page-3+i;
              if(p<1||p>pages) return null;
              return (
                <button key={p} onClick={()=>setPage(p)}
                  style={{width:30,height:30,borderRadius:8,border:"1.5px solid",
                    borderColor:p===page?"#1e3a8a":"rgba(0,0,0,.1)",
                    background:p===page?"#1e3a8a":"white",cursor:"pointer",
                    color:p===page?"white":"#374151",fontSize:12,fontWeight:p===page?700:500}}>
                  {p}
                </button>
              );
            })}
            <button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}
              style={{padding:"6px 10px",borderRadius:9,border:"1.5px solid rgba(0,0,0,.1)",
                background:"white",cursor:page>=pages?"not-allowed":"pointer",
                color:page>=pages?"#d1d5db":"#374151",display:"flex",alignItems:"center",gap:4,fontSize:12.5}}>
              Suiv. <ChevronRight size={13}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fee rules tab ─────────────────────────────────────────────────────────────
function FeeRulesTab({ onImport }: { onImport: () => void }) {
  const [data,    setData]    = useState<FinancialFeeRule[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [typo,    setTypo]    = useState("");
  const [conf,    setConf]    = useState<""|"OUTDOOR"|"INDOOR">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFeeRules({
        typology:      typo || undefined,
        configuration: conf || undefined,
      });
      setData(res.results);
      setTotal(res.count);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [typo, conf]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Filter bar */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:"1",minWidth:180}}>
          <Search size={13} color="#94a3b8" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}/>
          <input value={typo} onChange={e=>setTypo(e.target.value)}
            placeholder="Filtrer par typologie…"
            style={{width:"100%",padding:"7px 10px 7px 30px",borderRadius:10,
              border:"1.5px solid rgba(0,0,0,.09)",outline:"none",fontSize:12.5,
              color:"#0f172a",background:"white",boxSizing:"border-box"}}/>
        </div>

        <select value={conf} onChange={e=>setConf(e.target.value as any)}
          style={{padding:"7px 10px",borderRadius:10,border:"1.5px solid rgba(0,0,0,.09)",
            fontSize:12.5,fontWeight:600,color:"#0f172a",background:"white",outline:"none"}}>
          <option value="">Indoor & Outdoor</option>
          <option value="OUTDOOR">Outdoor</option>
          <option value="INDOOR">Indoor</option>
        </select>

        <button onClick={load} style={{padding:"7px 10px",borderRadius:10,
          border:"1.5px solid rgba(0,0,0,.09)",background:"white",cursor:"pointer",
          color:"#64748b",display:"grid",placeItems:"center"}}>
          <RefreshCw size={14} style={loading?{animation:"spin 1s linear infinite"}:{}}/>
        </button>

        <button onClick={onImport}
          style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",
            borderRadius:10,border:"none",
            background:"linear-gradient(135deg,#1e3a8a,#2d52b8)",
            color:"white",cursor:"pointer",fontSize:12.5,fontWeight:600,
            boxShadow:"0 3px 10px rgba(30,58,138,.2)"}}>
          <Upload size={13}/> Importer catalogue
        </button>
      </div>

      <div style={{borderRadius:14,border:"1.5px solid rgba(0,0,0,.07)",overflow:"hidden",background:"white"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
          <thead>
            <tr style={{background:"rgba(30,58,138,.04)",borderBottom:"1.5px solid rgba(0,0,0,.07)"}}>
              {["Typologie","Config","Load (W)","Redevance (FCFA)","Cible (kWh)","Cible/Jour (kWh)"].map(h=>(
                <th key={h} style={{padding:"9px 14px",textAlign:"left",
                  fontWeight:700,color:"#374151",fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !data.length ? (
              <tr><td colSpan={6} style={{padding:"32px 0",textAlign:"center",color:"#94a3b8"}}>
                <Loader2 size={20} style={{animation:"spin 1s linear infinite",display:"block",margin:"0 auto 6px"}}/>
                <div style={{fontSize:12.5}}>Chargement…</div>
              </td></tr>
            ) : !data.length ? (
              <tr><td colSpan={6} style={{padding:"32px 0",textAlign:"center",color:"#94a3b8",fontSize:13}}>
                Aucune règle — importez le catalogue Redevances
              </td></tr>
            ) : data.map((r,i)=>(
              <tr key={r.id} style={{borderBottom:"1px solid rgba(0,0,0,.05)",
                background:i%2===0?"white":"rgba(248,250,252,.6)"}}>
                <td style={{padding:"9px 14px",fontWeight:600,color:"#0f172a",maxWidth:200,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.typology}</td>
                <td style={{padding:"9px 14px"}}>
                  <Badge color={r.configuration==="OUTDOOR"?"green":"blue"}>{r.configuration}</Badge>
                </td>
                <td style={{padding:"9px 14px",fontWeight:600,color:"#374151"}}>
                  {Number(r.load_w).toLocaleString("fr-FR")}
                </td>
                <td style={{padding:"9px 14px",fontWeight:700,color:"#1e3a8a"}}>
                  {parseFloat(r.redevance).toLocaleString("fr-FR")}
                </td>
                <td style={{padding:"9px 14px",color:"#374151"}}>
                  {r.cible_kwh ? parseFloat(r.cible_kwh).toLocaleString("fr-FR") : "—"}
                </td>
                <td style={{padding:"9px 14px",color:"#374151"}}>
                  {r.cible_kwh_j ? parseFloat(r.cible_kwh_j).toFixed(3) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{marginTop:10,fontSize:11.5,color:"#94a3b8"}}>
        {total.toLocaleString("fr-FR")} règles dans le catalogue
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function FinancialDataPage() {
  const [tab, setTab] = useState<"loads"|"rules">("loads");
  const [showUploadLoad, setShowUploadLoad] = useState(false);
  const [showUploadFee,  setShowUploadFee]  = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showEvaluate, setShowEvaluate] = useState(false);
  const [evaluateDefaults, setEvaluateDefaults] = useState<{ year?: number | ""; month?: number | "" }>({});
  return (
    <div style={{maxWidth:1200,margin:"0 auto"}}>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        flexWrap:"wrap",gap:14,marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,
            background:"linear-gradient(135deg,#1e3a8a,#2d52b8)",
            display:"grid",placeItems:"center",boxShadow:"0 4px 14px rgba(30,58,138,.25)"}}>
            <Database size={18} color="white"/>
          </div>
          <div>
            <h1 style={{fontSize:20,fontWeight:800,color:"#0f172a",
              letterSpacing:"-.03em",margin:0,fontFamily:"'Outfit',sans-serif"}}>
              Données financières
            </h1>
            <p style={{fontSize:12.5,color:"#64748b",margin:0}}>
              Loads mensuels & catalogue redevances
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:18,
        background:"rgba(0,0,0,.04)",padding:4,borderRadius:14,width:"fit-content"}}>
        {([
          {key:"loads", label:"Loads mensuels", icon:<Layers size={13}/>},
          {key:"rules", label:"Catalogue Redevances", icon:<Database size={13}/>},
        ] as const).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{display:"flex",alignItems:"center",gap:6,
              padding:"7px 16px",borderRadius:10,border:"none",cursor:"pointer",
              fontSize:12.5,fontWeight:600,transition:"all .18s",
              background:tab===t.key?"white":"transparent",
              color:tab===t.key?"#1e3a8a":"#64748b",
              boxShadow:tab===t.key?"0 1px 6px rgba(0,0,0,.08)":"none"}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{animation:"fadeIn .25s ease"}} key={tab}>
       {tab === "loads" ? (
          <LoadsTab
            key={refreshKey}
            onImport={() => setShowUploadLoad(true)}
            onEvaluate={(initial) => {
              setEvaluateDefaults(initial);
              setShowEvaluate(true);
            }}
          />
        ) : (
          <FeeRulesTab key={refreshKey} onImport={() => setShowUploadFee(true)} />
        )}
      </div>

      {/* Upload modals */}
      {showUploadLoad && (
        <UploadModal
          title="Import loads mensuels"
          description="Formats acceptés : Load_SNTL_CMST (aligné), Proposition (prévisionnel), CSV générique"
          accept=".xlsx,.xls,.csv"
          onClose={()=>{setShowUploadLoad(false);setRefreshKey(k=>k+1);}}
          onUpload={importMonthlyLoads}
        />
      )}
      
      {showEvaluate && (
        <EvaluateLoadsModal
          initialYear={evaluateDefaults.year}
          initialMonth={evaluateDefaults.month}
          onClose={() => setShowEvaluate(false)}
          onDone={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {showUploadFee && (
        <UploadModal
          title="Import catalogue Redevances"
          description="Fichier Redevance_et_Cible_Akt.xlsx — Typologie × Config × Load → Redevance"
          accept=".xlsx,.xls"
          onClose={()=>{setShowUploadFee(false);setRefreshKey(k=>k+1);}}
          onUpload={importFeeRules}
        />
      )}
    </div>
  );
}