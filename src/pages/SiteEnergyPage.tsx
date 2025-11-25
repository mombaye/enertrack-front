// src/pages/SiteEnergyPage.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Upload, Search, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import EnergySubnav from "@/components/energy/EnergySubnav";
import {
  listSiteEnergy,
  uploadSiteEnergyFile,
  SiteEnergyRow,
  SiteEnergyListParams,
} from "@/services/siteEnergy";

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const toMonth = (m:number)=> months[(m-1+12)%12] ?? String(m);

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
    </div>
  );
}

export default function SiteEnergyPage() {
  const [rows, setRows] = useState<SiteEnergyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string | undefined>();
  const [month, setMonth] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Upload modal
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File|null>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLSelectElement>(null);

  const params: SiteEnergyListParams = useMemo(()=>({
    page, page_size: pageSize, q: query || undefined, year, month
  }), [page, pageSize, query, year, month]);

  async function reload() {
    setLoading(true);
    try {
      const res = await listSiteEnergy(params);
      setRows(res.items);
      setTotal(res.total);
    } catch (e:any) {
      toast.error(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ reload(); /* eslint-disable-next-line */ }, [page, pageSize, query, year, month]);

  const kpi = useMemo(()=>{
    if (!rows.length) return null;
    const count = rows.length;
    const avgRER = rows.reduce((s,r)=>s+(Number(r.rer_pct)||0),0)/count;
    const avgRouter = rows.reduce((s,r)=>s+(Number(r.router_availability_pct)||0),0)/count;
    const avgPwM = rows.reduce((s,r)=>s+(Number(r.pwm_availability_pct)||0),0)/count;
    const avgPwC = rows.reduce((s,r)=>s+(Number(r.pwc_availability_pct)||0),0)/count;
    return {count, avgRER, avgRouter, avgPwM, avgPwC};
  }, [rows]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.info("Choisissez un fichier");
    try {
      setLoading(true);
      const extra: Record<string,string> = {};
      if (countryRef.current?.value) extra.country = countryRef.current.value;
      if (yearRef.current?.value) extra.year = yearRef.current.value;
      if (monthRef.current?.value) extra.month = monthRef.current.value;
      await uploadSiteEnergyFile(file, extra);
      toast.success("Import sites effectué");
      setModalOpen(false); setFile(null);
      await reload();
    } catch (e:any) {
      toast.error(e?.message || "Échec de l'import");
    } finally { setLoading(false); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Title + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-slate-800">Énergie — Sites</h1>
          <EnergySubnav />
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

      {/* Filtres */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Rechercher (site id, nom…) "
            value={query}
            onChange={(e)=>{ setPage(1); setQuery(e.target.value); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Année</label>
          <input
            type="number" inputMode="numeric" placeholder="2025"
            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={year || ""}
            onChange={(e)=>{ setPage(1); setYear(e.target.value || undefined); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Mois</label>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={month || ""}
            onChange={(e)=>{ setPage(1); setMonth(e.target.value || undefined); }}
          >
            <option value="">Tous</option>
            {months.map((m, i)=> <option key={m} value={String(i+1)}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Nb de sites" value={kpi ? kpi.count : "—"} />
        <StatCard title="RER moyen (%)" value={kpi ? kpi.avgRER.toFixed(1) : "—"} />
        <StatCard title="Router avail. (%)" value={kpi ? kpi.avgRouter.toFixed(1) : "—"} />
        <StatCard title="PwM avail. (%)" value={kpi ? kpi.avgPwM.toFixed(1) : "—"} />
        <StatCard title="PwC avail. (%)" value={kpi ? kpi.avgPwC.toFixed(1) : "—"} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Site ID</th>
              <th className="px-3 py-2 text-left">Nom</th>
              <th>Pays</th>
              <th>Année</th>
              <th>Mois</th>
              <th>GRID</th>
              <th>DG</th>
              <th>Solar</th>
              <th className="text-right">GRID kWh</th>
              <th className="text-right">SOLAR kWh</th>
              <th className="text-right">TEL kWh</th>
              <th className="text-right">GRID %</th>
              <th className="text-right">RER %</th>
              <th className="text-right">Router %</th>
              <th className="text-right">PwM %</th>
              <th className="text-right">PwC %</th>
              <th>Fichier</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={17} className="p-6 text-center text-slate-500">Chargement…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={17} className="p-6 text-center text-slate-500">Aucune donnée</td></tr>
            )}
            {!loading && rows.map((r)=>(
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2">{r.site.site_id}</td>
                <td className="px-3 py-2">{r.site.site_name}</td>
                <td className="px-3 py-2">{r.site.country?.name || ""}</td>
                <td className="px-3 py-2">{r.year}</td>
                <td className="px-3 py-2">{toMonth(Number(r.month))}</td>
                <td className="px-3 py-2">{r.grid_status}</td>
                <td className="px-3 py-2">{r.dg_status}</td>
                <td className="px-3 py-2">{r.solar_status}</td>
                <td className="px-3 py-2 text-right">{r.grid_energy_kwh ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.solar_energy_kwh ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.telecom_load_kwh ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.grid_energy_pct ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.rer_pct ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.router_availability_pct ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.pwm_availability_pct ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.pwc_availability_pct ?? ""}</td>
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
          {Array.from({length: totalPages}).map((_,i)=>(
            <option key={i} value={i+1}>{i+1}</option>
          ))}
        </select>
        <span className="text-sm text-slate-600">/ Taille</span>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
          value={pageSize}
          onChange={(e)=>{ setPage(1); setPageSize(Number(e.target.value)); }}
        >
          {[10,20,50,100].map(s=><option key={s} value={s}>{s}</option>)}
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
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Importer Sites energy</h3>
            <form className="space-y-4" onSubmit={onUpload}>
              <div>
                <label className="text-sm text-slate-600">Fichier (.xlsx / .csv)</label>
                <input
                  type="file" accept=".xlsx,.xls,.csv"
                  onChange={(e)=>setFile(e.target.files?.[0]||null)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm text-slate-600">Pays (opt.)</label>
                  <input ref={countryRef} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="Senegal" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Année (opt.)</label>
                  <input ref={yearRef} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="2025" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Mois (opt.)</label>
                  <select ref={monthRef} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <option value=""></option>
                    {months.map((m,i)=><option key={m} value={String(i+1)}>{m}</option>)}
                  </select>
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
