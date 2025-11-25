// src/pages/PowerQualityPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Search, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import { format } from "date-fns";
import {
  listPQReports,
  uploadPQFile,
  PQReport,
  PQListParams,
} from "@/services/powerquality";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from "recharts";

const cls = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
    </div>
  );
}

export default function PowerQualityPage() {
  const [rows, setRows] = useState<PQReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const params: PQListParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      q: q || undefined,
      country: country || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [page, pageSize, q, country, dateFrom, dateTo]
  );

  async function reload() {
    setLoading(true);
    try {
      const res = await listPQReports(params);
      setRows(res.items);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q, country, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    if (!rows.length) return null;
    const totalMono = rows.reduce((s, r) => s + (Number(r.mono_energy_consumed_kwh) || 0), 0);
    const totalTriAct = rows.reduce((s, r) => s + (Number(r.tri_active_energy_kwh) || 0), 0);
    const totalTriReact = rows.reduce((s, r) => s + (Number(r.tri_reactive_energy_kvarh) || 0), 0);
    const totalKVAh = rows.reduce((s, r) => s + (Number(r.tri_apparent_energy_kvah) || 0), 0);

    // top 15 par énergie active tri
    const bySite = [...rows]
      .sort((a, b) => (Number(b.tri_active_energy_kwh) || 0) - (Number(a.tri_active_energy_kwh) || 0))
      .slice(0, 15)
      .map(r => ({
        site: r.site?.site_id ?? "",
        active_kwh: Number(r.tri_active_energy_kwh) || 0,
        mono_kwh: Number(r.mono_energy_consumed_kwh) || 0,
      }));

    return { totalMono, totalTriAct, totalTriReact, totalKVAh, bySite };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.info("Choisissez un fichier");
      return;
    }
    try {
      setLoading(true);
      await uploadPQFile(file);
      toast.success("Import terminé");
      setModalOpen(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'import");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Power Quality — Compteurs</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
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
            placeholder="Rechercher (site id, nom)…"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
          />
        </div>
        <input
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
          placeholder="Pays"
          value={country}
          onChange={(e) => { setPage(1); setCountry(e.target.value); }}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
            value={dateFrom}
            onChange={(e) => { setPage(1); setDateFrom(e.target.value); }}
          />
          <input
            type="date"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
            value={dateTo}
            onChange={(e) => { setPage(1); setDateTo(e.target.value); }}
          />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Mono — Énergie (kWh)" value={kpis ? Math.round(kpis.totalMono).toLocaleString() : "—"} />
        <Card title="Tri — Énergie active (kWh)" value={kpis ? Math.round(kpis.totalTriAct).toLocaleString() : "—"} />
        <Card title="Tri — Réactive (kVArh)" value={kpis ? Math.round(kpis.totalTriReact).toLocaleString() : "—"} />
        <Card title="Tri — Apparente (kVAh)" value={kpis ? Math.round(kpis.totalKVAh).toLocaleString() : "—"} />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Top 15 — Énergie par site</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={kpis?.bySite || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="site" />
              <YAxis />
              <RTooltip />
              <Legend />
              <Bar dataKey="active_kwh" name="Tri Actif (kWh)" />
              <Bar dataKey="mono_kwh" name="Mono (kWh)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Pays</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Début</th>
              <th className="px-3 py-2">Fin</th>
              <th className="px-3 py-2 text-right">Mono Vavg</th>
              <th className="px-3 py-2 text-right">Mono Iavg</th>
              <th className="px-3 py-2 text-right">Mono Pavg</th>
              <th className="px-3 py-2 text-right">Mono Énergie (kWh)</th>
              <th className="px-3 py-2 text-right">Tri Actif (kWh)</th>
              <th className="px-3 py-2 text-right">Tri Réactif (kVArh)</th>
              <th className="px-3 py-2 text-right">Tri Apparent (kVAh)</th>
              <th className="px-3 py-2">Fichier</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={12} className="p-6 text-center text-slate-500">Chargement…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="p-6 text-center text-slate-500">Aucune donnée</td>
              </tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2">{r.country?.name}</td>
                <td className="px-3 py-2">{r.site?.site_id}</td>
                <td className="px-3 py-2">{r.begin_period ? format(new Date(r.begin_period), "yyyy-MM-dd") : ""}</td>
                <td className="px-3 py-2">{r.end_period ? format(new Date(r.end_period), "yyyy-MM-dd") : ""}</td>
                <td className="px-3 py-2 text-right">{r.mono_vavg_v ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.mono_iavg_a ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.mono_pavg_kw ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.mono_energy_consumed_kwh ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.tri_active_energy_kwh ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.tri_reactive_energy_kvarh ?? ""}</td>
                <td className="px-3 py-2 text-right">{r.tri_apparent_energy_kvah ?? ""}</td>
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
          onChange={(e) => setPage(Number(e.target.value))}
        >
          {Array.from({ length: totalPages }).map((_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <span className="text-sm text-slate-600">/ Taille</span>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
          value={pageSize}
          onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
        >
          {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative w-[95%] max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Importer un fichier Power Quality</h3>
            <form className="space-y-4" onSubmit={onUpload}>
              <div>
                <label className="text-sm text-slate-600">Fichier (.xlsx / .csv)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl bg-white px-4 py-2 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2 text-white hover:bg-blue-800"
                >
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
