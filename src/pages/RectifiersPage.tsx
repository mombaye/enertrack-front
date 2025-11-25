// src/pages/RectifiersPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, RefreshCw, Search, X } from "lucide-react";
import { toast } from "react-toastify";
import {
  listRectifiers,
  uploadRectifierFile,
  RectifierReading,
  RectifierListParams,
} from "@/services/rectifiers";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from "recharts";

function classNames(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" "); }
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : "—");

function StatCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function RectifiersPage() {
  const [rows, setRows] = useState<RectifierReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // filters
  const [q, setQ] = useState("");
  const [siteId, setSiteId] = useState("");
  const [country, setCountry] = useState("");
  const [param, setParam] = useState("avg_im_CurrentRectifierValue");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // upload
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File|null>(null);
  const countryRef = useRef<HTMLInputElement>(null);

  const params: RectifierListParams = useMemo(()=>({
    page, page_size: pageSize,
    q: q || undefined,
    site_id: siteId || undefined,
    country: country || undefined,
    param: param || undefined,
    date_from: from || undefined,
    date_to: to || undefined,
  }), [page, pageSize, q, siteId, country, param, from, to]);

  async function reload() {
    setLoading(true);
    try {
      const res = await listRectifiers(params);
      setRows(res.items);
      setTotal(res.total);
    } catch (e:any) {
      toast.error(e?.message || "Erreur de chargement");
    } finally { setLoading(false); }
  }

  useEffect(()=>{ reload(); /* eslint-disable-next-line */ }, [page, pageSize, q, siteId, country, param, from, to]);

  // KPI + chart data
  const kpi = useMemo(()=>{
    if (!rows.length) return null;
    const values = rows.map(r => Number(r.param_value || 0)).filter(v => !Number.isNaN(v));
    const count = values.length;
    const avg = count ? values.reduce((s,v)=>s+v,0)/count : 0;
    const max = count ? Math.max(...values) : 0;
    const nonZero = values.filter(v => v>0).length;
    return { count, avg, max, nonZero };
  }, [rows]);

  const timeseries = useMemo(()=>{
    // group by date (YYYY-MM-DD), compute avg param_value
    const map = new Map<string, { sum:number; n:number }>();
    for (const r of rows) {
      const d = r.measured_at?.slice(0,10);
      const v = Number(r.param_value || 0);
      if (!d || Number.isNaN(v)) continue;
      const cur = map.get(d) || { sum:0, n:0 };
      cur.sum += v; cur.n += 1;
      map.set(d, cur);
    }
    return Array.from(map.entries())
      .map(([d, {sum,n}]) => ({ date: d, avg: n? sum/n : 0 }))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }, [rows]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.info("Choisissez un fichier");
    try {
      setLoading(true);
      const extra: Record<string,string> = {};
      if (countryRef.current?.value) extra.country = countryRef.current.value;
      await uploadRectifierFile(file, extra);
      toast.success("Import rectifiers effectué");
      setModalOpen(false); setFile(null);
      await reload();
    } catch (e:any) {
      toast.error(e?.message || "Échec import");
    } finally { setLoading(false); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* actions & filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="w-64 rounded-2xl border border-slate-200 bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Rechercher (site, param...)"
              value={q}
              onChange={(e)=>{ setPage(1); setQ(e.target.value); }}
            />
          </div>
          <input
            className="w-36 rounded-2xl border border-slate-200 bg-white px-3 py-2"
            placeholder="Site ID (ex DKR_0224)"
            value={siteId}
            onChange={(e)=>{ setPage(1); setSiteId(e.target.value); }}
          />
          <input
            className="w-36 rounded-2xl border border-slate-200 bg-white px-3 py-2"
            placeholder="Pays (ex Senegal)"
            value={country}
            onChange={(e)=>{ setPage(1); setCountry(e.target.value); }}
          />
          <input
            className="w-72 rounded-2xl border border-slate-200 bg-white px-3 py-2"
            placeholder="Param (ex avg_im_CurrentRectifierValue)"
            value={param}
            onChange={(e)=>{ setPage(1); setParam(e.target.value); }}
          />
          <input type="date"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
            value={from} onChange={(e)=>{ setPage(1); setFrom(e.target.value); }} />
          <input type="date"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
            value={to} onChange={(e)=>{ setPage(1); setTo(e.target.value); }} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={()=>setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-900 px-4 py-2 text-white shadow-sm hover:bg-blue-800"
          >
            <Upload className="h-4 w-4" /> Importer
          </button>
          <button
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-blue-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Nb mesures" value={kpi ? kpi.count : "—"} />
        <StatCard title="Moyenne" value={kpi ? kpi.avg.toFixed(3) : "—"} hint={param} />
        <StatCard title="Max" value={kpi ? kpi.max.toFixed(3) : "—"} />
        <StatCard title="> 0" value={kpi ? kpi.nonZero : "—"} hint="mesures non nulles" />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Moyenne journalière ({param})</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={timeseries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <RTooltip />
              <Legend />
              <Line type="monotone" dataKey="avg" name="Moyenne" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Site ID</th>
              <th className="px-3 py-2 text-left">Nom</th>
              <th className="px-3 py-2">Pays</th>
              <th className="px-3 py-2">Param</th>
              <th className="px-3 py-2 text-right">Valeur</th>
              <th className="px-3 py-2">Unité</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Fichier</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">Chargement…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">Aucune donnée</td></tr>
            )}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2">{r.site?.site_id}</td>
                <td className="px-3 py-2">{r.site?.site_name}</td>
                <td className="px-3 py-2">{r.site?.country?.name || ""}</td>
                <td className="px-3 py-2">{r.param_name}</td>
                <td className="px-3 py-2 text-right">{r.param_value ?? ""}</td>
                <td className="px-3 py-2">{r.measure || ""}</td>
                <td className="px-3 py-2">{fmtDate(r.measured_at)}</td>
                <td className="px-3 py-2">{r.source_filename || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-slate-600">Page</span>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
          value={page}
          onChange={(e)=>setPage(Number(e.target.value))}
        >
          {Array.from({length: Math.max(1, Math.ceil(total / pageSize))}).map((_,i)=>(
            <option key={i} value={i+1}>{i+1}</option>
          ))}
        </select>
        <span className="text-sm text-slate-600">/ Taille</span>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
          value={pageSize}
          onChange={(e)=>{ setPage(1); setPageSize(Number(e.target.value)); }}
        >
          {[25,50,100,200].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setModalOpen(false)} />
          <div className="relative w-[95%] max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <button onClick={()=>setModalOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Importer rectifiers</h3>
            <form className="space-y-4" onSubmit={onUpload}>
              <div>
                <label className="text-sm text-slate-600">Fichier (.xlsx / .csv)</label>
                <input
                  type="file" accept=".xlsx,.xls,.csv"
                  onChange={(e)=>setFile(e.target.files?.[0]||null)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">Pays (optionnel)</label>
                  <input ref={countryRef} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="Senegal" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setModalOpen(false)} className="rounded-xl bg-white px-4 py-2 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Annuler</button>
                <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2 text-white hover:bg-blue-800">
                  <Upload className="h-4 w-4" /> Importer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
