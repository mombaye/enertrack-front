import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Search,
  Filter,
  Upload,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  MapPinned,
  Factory,
  CheckCircle2,
  XCircle,
  SunMedium,
  FileSpreadsheet,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import type { Site } from "./api";
import {
  useCreateSite,
  useDeleteSite,
  useImportSites,
  useSites,
  useUpdateSite,
} from "./hooks";

type SiteFormState = {
  site_id: string;
  name: string;
  modernized: "" | "true" | "false";
  ordered_typology: string;
  installed_typology: string;
  contract_number: string;
  meter_number: string;
  billing_typology: string;
  load_analyses: string;
  site_type: string;
  transformer_capacity: string;
  indoor_billed_outdoor: "" | "true" | "false";
  not_yet_solarized: "" | "true" | "false";
  energy_desk_comment: string;
  invoice_payment: string;
  grid_fee: "" | "true" | "false";
  batch_operational: string;
  zone: string;
};

const EMPTY_FORM: SiteFormState = {
  site_id: "",
  name: "",
  modernized: "",
  ordered_typology: "",
  installed_typology: "",
  contract_number: "",
  meter_number: "",
  billing_typology: "",
  load_analyses: "",
  site_type: "",
  transformer_capacity: "",
  indoor_billed_outdoor: "",
  not_yet_solarized: "",
  energy_desk_comment: "",
  invoice_payment: "",
  grid_fee: "",
  batch_operational: "",
  zone: "",
};

function toBool(value: "" | "true" | "false"): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function toNullableString(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

function toNullableNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const parsed = Number(v);
  return Number.isNaN(parsed) ? null : parsed;
}

function siteToForm(site: Site): SiteFormState {
  return {
    site_id: site.site_id || "",
    name: site.name || "",
    modernized:
      site.modernized === true ? "true" : site.modernized === false ? "false" : "",
    ordered_typology: site.ordered_typology || "",
    installed_typology: site.installed_typology || "",
    contract_number: site.contract_number || "",
    meter_number: site.meter_number || "",
    billing_typology: site.billing_typology || "",
    load_analyses: site.load_analyses != null ? String(site.load_analyses) : "",
    site_type: site.site_type || "",
    transformer_capacity:
      site.transformer_capacity != null ? String(site.transformer_capacity) : "",
    indoor_billed_outdoor:
      site.indoor_billed_outdoor === true
        ? "true"
        : site.indoor_billed_outdoor === false
        ? "false"
        : "",
    not_yet_solarized:
      site.not_yet_solarized === true
        ? "true"
        : site.not_yet_solarized === false
        ? "false"
        : "",
    energy_desk_comment: site.energy_desk_comment || "",
    invoice_payment: site.invoice_payment || "",
    grid_fee:
      site.grid_fee === true ? "true" : site.grid_fee === false ? "false" : "",
    batch_operational: site.batch_operational || "",
    zone: site.zone || "",
  };
}

function formToPayload(form: SiteFormState): Partial<Site> {
  return {
    site_id: form.site_id.trim(),
    name: form.name.trim(),
    modernized: toBool(form.modernized),
    ordered_typology: toNullableString(form.ordered_typology),
    installed_typology: toNullableString(form.installed_typology),
    contract_number: toNullableString(form.contract_number),
    meter_number: toNullableString(form.meter_number),
    billing_typology: toNullableString(form.billing_typology),
    load_analyses: toNullableNumber(form.load_analyses),
    site_type: toNullableString(form.site_type),
    transformer_capacity: toNullableNumber(form.transformer_capacity),
    indoor_billed_outdoor: toBool(form.indoor_billed_outdoor),
    not_yet_solarized: toBool(form.not_yet_solarized),
    energy_desk_comment: toNullableString(form.energy_desk_comment),
    invoice_payment: toNullableString(form.invoice_payment),
    grid_fee: toBool(form.grid_fee),
    batch_operational: toNullableString(form.batch_operational),
    zone: toNullableString(form.zone),
  };
}

function BoolBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Oui
      </span>
    );
  }

  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <XCircle className="h-3.5 w-3.5" />
        Non
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
      —
    </span>
  );
}

function SoftBadge({ label }: { label?: string | null }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      {label || "—"}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
  hint,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500">{hint}</p>
        </div>
        <div className="rounded-2xl bg-blue-900 p-3 text-white shadow-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SiteModal({
  open,
  mode,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  form: SiteFormState;
  setForm: React.Dispatch<React.SetStateAction<SiteFormState>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  const title = mode === "create" ? "Nouveau site" : "Modifier le site";

  const setField = (key: keyof SiteFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const BoolSelect = ({
    label,
    value,
    field,
  }: {
    label: string;
    value: "" | "true" | "false";
    field: keyof SiteFormState;
  }) => (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => setField(field, e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      >
        <option value="">—</option>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    </label>
  );

  const TextField = ({
    label,
    value,
    field,
    type = "text",
    required = false,
    disabled = false,
  }: {
    label: string;
    value: string;
    field: keyof SiteFormState;
    type?: string;
    required?: boolean;
    disabled?: boolean;
  }) => (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => setField(field, e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Renseignez les champs du référentiel site.
            </p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Code site"
              value={form.site_id}
              field="site_id"
              required
              disabled={mode === "edit"}
            />
            <TextField label="Nom" value={form.name} field="name" required />
            <TextField label="Zone" value={form.zone} field="zone" />

            <BoolSelect label="Modernisé" value={form.modernized} field="modernized" />
            <TextField
              label="Typologie commandée"
              value={form.ordered_typology}
              field="ordered_typology"
            />
            <TextField
              label="Typologie installée"
              value={form.installed_typology}
              field="installed_typology"
            />

            <TextField
              label="Numéro contrat"
              value={form.contract_number}
              field="contract_number"
            />
            <TextField
              label="Numéro compteur"
              value={form.meter_number}
              field="meter_number"
            />
            <TextField
              label="Typologie facturation"
              value={form.billing_typology}
              field="billing_typology"
            />

            <TextField
              label="Load Analyses"
              value={form.load_analyses}
              field="load_analyses"
              type="number"
            />
            <TextField label="Type" value={form.site_type} field="site_type" />
            <TextField
              label="Capacité transformateur"
              value={form.transformer_capacity}
              field="transformer_capacity"
              type="number"
            />

            <BoolSelect
              label="Indoor facturé outdoor"
              value={form.indoor_billed_outdoor}
              field="indoor_billed_outdoor"
            />
            <BoolSelect
              label="Non encore solarisé"
              value={form.not_yet_solarized}
              field="not_yet_solarized"
            />
            <BoolSelect label="Redevance Grid" value={form.grid_fee} field="grid_fee" />

            <TextField
              label="Paiement facture"
              value={form.invoice_payment}
              field="invoice_payment"
            />
            <TextField
              label="Batch opérationnel"
              value={form.batch_operational}
              field="batch_operational"
            />

            <label className="space-y-2 md:col-span-2 xl:col-span-3">
              <span className="text-sm font-medium text-slate-700">
                Commentaire Energy Desk
              </span>
              <textarea
                rows={4}
                value={form.energy_desk_comment}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, energy_desk_comment: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSitesPage() {
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("all");
  const [type, setType] = useState("all");
  const [payment, setPayment] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [form, setForm] = useState<SiteFormState>(EMPTY_FORM);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: rows = [], isLoading, isFetching, refetch } = useSites();
  const createMutation = useCreateSite();
  const updateMutation = useUpdateSite();
  const deleteMutation = useDeleteSite();
  const importMutation = useImportSites();

  const filtered = useMemo(() => {
    return rows.filter((site) => {
      const q = query.trim().toLowerCase();

      const matchQuery =
        !q ||
        site.site_id.toLowerCase().includes(q) ||
        site.name.toLowerCase().includes(q) ||
        (site.contract_number || "").toLowerCase().includes(q) ||
        (site.meter_number || "").toLowerCase().includes(q) ||
        (site.installed_typology || "").toLowerCase().includes(q);

      const matchZone = zone === "all" || (site.zone || "").toUpperCase() === zone;
      const matchType =
        type === "all" || (site.site_type || "").toLowerCase() === type.toLowerCase();
      const matchPayment =
        payment === "all" ||
        (site.invoice_payment || "").toLowerCase() === payment.toLowerCase();

      return matchQuery && matchZone && matchType && matchPayment;
    });
  }, [rows, query, zone, type, payment]);

  const stats = useMemo(() => {
    const total = rows.length;
    const modernized = rows.filter((s) => s.modernized === true).length;
    const solarPending = rows.filter((s) => s.not_yet_solarized === true).length;
    const indoor = rows.filter((s) => (s.site_type || "").toLowerCase() === "indoor").length;

    return { total, modernized, solarPending, indoor };
  }, [rows]);

  const zoneStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const site of rows) {
      const z = site.zone || "—";
      map.set(z, (map.get(z) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [rows]);

  const completeness = useMemo(() => {
    if (!rows.length) return 0;
    const scored = rows.map((site) => {
      let filled = 0;
      const fields = [
        site.site_id,
        site.name,
        site.zone,
        site.installed_typology,
        site.contract_number,
        site.meter_number,
        site.site_type,
        site.invoice_payment,
      ];
      fields.forEach((v) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") filled += 1;
      });
      return filled / fields.length;
    });
    const avg = scored.reduce((a, b) => a + b, 0) / scored.length;
    return Math.round(avg * 100);
  }, [rows]);

  useEffect(() => {
    if (!modalOpen) {
      setEditingSite(null);
      setForm(EMPTY_FORM);
    }
  }, [modalOpen]);

  const openCreate = () => {
    setEditingSite(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (site: Site) => {
    setEditingSite(site);
    setForm(siteToForm(site));
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.site_id.trim()) {
      toast.error("Le code site est obligatoire.");
      return;
    }

    if (!form.name.trim()) {
      toast.error("Le nom du site est obligatoire.");
      return;
    }

    const payload = formToPayload(form);

    try {
      if (editingSite) {
        await updateMutation.mutateAsync({ id: editingSite.id, payload });
        toast.success("Site mis à jour avec succès.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Site créé avec succès.");
      }
      setModalOpen(false);
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        "Une erreur est survenue.";
      toast.error(detail);
    }
  };

  const handleDelete = async (site: Site) => {
    const ok = window.confirm(
      `Supprimer le site ${site.site_id} - ${site.name} ?`
    );
    if (!ok) return;

    try {
      await deleteMutation.mutateAsync(site.id);
      toast.success("Site supprimé avec succès.");
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        "Impossible de supprimer ce site.";
      toast.error(detail);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await importMutation.mutateAsync(file);
      const msg =
        res?.message ||
        "Import terminé avec succès.";
      toast.success(msg);
      if (res?.errors_count) {
        toast.info(`${res.errors_count} ligne(s) en erreur détectée(s).`);
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        "Erreur lors de l'import Excel.";
      toast.error(detail);
    } finally {
      e.target.value = "";
    }
  };

  const loading =
    isLoading ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    importMutation.isPending;

  return (
    <div className="min-h-full bg-slate-50">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 md:px-6 xl:px-8">
        <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                <Building2 className="h-4 w-4" />
                Administration
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
                Gestion des sites
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-blue-100/85 md:text-base">
                Gérez le référentiel des sites, l’import Excel, les informations
                de facturation, les typologies et les statuts de modernisation.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleImportClick}
                disabled={importMutation.isPending}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-70"
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import Excel
              </button>

              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-950 shadow-lg transition hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                Nouveau site
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total sites"
            value={stats.total}
            hint="Référentiel global"
            icon={<Building2 className="h-5 w-5" />}
          />
          <StatCard
            title="Modernisés"
            value={stats.modernized}
            hint="Sites marqués Oui"
            icon={<RefreshCw className="h-5 w-5" />}
          />
          <StatCard
            title="Indoor"
            value={stats.indoor}
            hint="Typologie de site"
            icon={<Factory className="h-5 w-5" />}
          />
          <StatCard
            title="À solariser"
            value={stats.solarPending}
            hint="Sites non encore solarisés"
            icon={<SunMedium className="h-5 w-5" />}
          />
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher par code site, nom, contrat, compteur..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:w-[520px]">
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">Toutes les zones</option>
                {Array.from(new Set(rows.map((r) => r.zone).filter(Boolean) as string[]))
                  .sort()
                  .map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
              </select>

              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">Tous les types</option>
                <option value="Indoor">Indoor</option>
                <option value="Outdoor">Outdoor</option>
              </select>

              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">Tous paiements</option>
                <option value="Aktivco">Aktivco</option>
                <option value="Sonatel">Sonatel</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  Référentiel des sites
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filtered.length} site(s) affiché(s)
                  {isFetching && !isLoading ? " • rafraîchissement..." : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => {
                    setQuery("");
                    setZone("all");
                    setType("all");
                    setPayment("all");
                  }}
                >
                  <Filter className="h-4 w-4" />
                  Réinitialiser
                </button>

                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Actualiser
                </button>

                <button
                  onClick={handleImportClick}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Import Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1450px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="border-b border-slate-300">
                    {[
                      "Code site",
                      "Nom",
                      "Zone",
                      "Modernisé",
                      "Typologie installée",
                      "Numéro contrat",
                      "Compteur",
                      "Load",
                      "Type",
                      "Paiement",
                      "Grid",
                      "Solarisé",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={13} className="px-6 py-16 text-center">
                        <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement des sites...
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length ? (
                    filtered.map((site) => (
                      <tr
                        key={site.id}
                        className="border-b border-slate-300 transition hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {site.site_id}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{site.name}</td>
                        <td className="px-4 py-3">
                          <SoftBadge label={site.zone} />
                        </td>
                        <td className="px-4 py-3">
                          <BoolBadge value={site.modernized} />
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {site.installed_typology || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {site.contract_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {site.meter_number || "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {site.load_analyses ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <SoftBadge label={site.site_type} />
                        </td>
                        <td className="px-4 py-3">
                          <SoftBadge label={site.invoice_payment} />
                        </td>
                        <td className="px-4 py-3">
                          <BoolBadge value={site.grid_fee} />
                        </td>
                        <td className="px-4 py-3">
                          <BoolBadge
                            value={
                              site.not_yet_solarized === null
                                ? null
                                : !site.not_yet_solarized
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(site)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(site)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={13} className="px-6 py-12 text-center text-sm text-slate-500">
                        Aucun site trouvé avec les filtres actuels.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold tracking-tight text-slate-900">
                Actions rapides
              </h3>
              <div className="mt-4 space-y-3">
                <button
                  onClick={openCreate}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4 text-blue-700" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Créer un site
                    </div>
                    <div className="text-xs text-slate-500">
                      Ajouter une nouvelle entrée au référentiel
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleImportClick}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4 text-emerald-700" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Importer un fichier Excel
                    </div>
                    <div className="text-xs text-slate-500">
                      Mettre à jour les sites existants et créer les nouveaux
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => refetch()}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4 text-amber-700" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Synchroniser les données
                    </div>
                    <div className="text-xs text-slate-500">
                      Rafraîchir le référentiel depuis la base
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold tracking-tight text-slate-900">
                Résumé
              </h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <MapPinned className="h-4 w-4 text-blue-700" />
                    Distribution zones
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {zoneStats.length ? (
                      zoneStats.map(([z, count]) => (
                        <div key={z} className="flex items-center justify-between">
                          <span>{z}</span>
                          <span className="font-semibold text-slate-900">{count}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500">Aucune donnée</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-800">
                    Qualité référentiel
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-800 transition-all"
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {completeness}% des lignes ont les informations principales
                    correctement renseignées.
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                  <div className="flex items-start gap-3">
                    <Factory className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      Les opérations de création, modification, suppression et import
                      sont directement connectées aux endpoints backend du module Sites.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SiteModal
          open={modalOpen}
          mode={editingSite ? "edit" : "create"}
          form={form}
          setForm={setForm}
          saving={loading}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}