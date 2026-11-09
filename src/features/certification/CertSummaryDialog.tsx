// Résumé d'une campagne de certification — ouvert automatiquement à la fin d'un calcul, et à la demande.
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, MapPin, Receipt, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getCertBatchSummary, type CertSummaryGroup } from "@/services/certification";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const F = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
const FCFA = (n: number | null | undefined) => (n == null ? "montant absent" : `${nf.format(n)} F`);

const RULE_LABEL: Record<string, string> = {
  FMS_PERIODE: "Grid — période", FMS_30J: "Grid — 30 j",
  ACM_PERIODE: "ACM — période", ACM_30J: "ACM — 30 j", HISTO_3MOIS: "Historique 3 mois",
};
const STATUS_LABEL: Record<string, string> = {
  NEEDS_REVIEW: "Contestée", MESURE_A_VERIFIER: "Mesure à vérifier",
};

function duration(s: number | null) {
  if (s == null) return null;
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

function Tile({ label, g, tone, icon }: { label: string; g: CertSummaryGroup; tone: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold">{icon}{label}</div>
      <div className="mt-1 text-[22px] font-extrabold tabular-nums leading-none">{F(g.count)}</div>
      <div className="mt-1 text-[11px] opacity-80 tabular-nums">
        {g.pct == null ? "—" : `${g.pct.toLocaleString("fr-FR")} %`} · {FCFA(g.montant_ttc)}
      </div>
    </div>
  );
}

export function CertSummaryDialog({ batchId, onClose, onShowStatus }: {
  batchId: number | null;
  onClose: () => void;
  /** Filtre le tableau sur un statut (ex. « NEEDS_REVIEW ») et ferme la fenêtre. */
  onShowStatus?: (status: string) => void;
}) {
  const { data: s, isLoading, isError, refetch } = useQuery({
    queryKey: ["cert-summary", batchId],
    queryFn: () => getCertBatchSummary(batchId!),
    enabled: batchId !== null,
  });

  const go = (status: string) => { onShowStatus?.(status); onClose(); };

  return (
    <Dialog open={batchId !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button]:hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <DialogTitle className="text-[16px] font-extrabold text-slate-900">
              Résumé de la certification{s ? ` — échéance ${s.echeance}` : ""}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-slate-500 mt-0.5">
              {s ? <>{F(s.total)} factures · {FCFA(s.montant_ttc_total)} TTC{duration(s.duration_s) ? ` · calculé en ${duration(s.duration_s)}` : ""}</> : "Synthèse des statuts, montants et sites rattachés."}
            </DialogDescription>
          </div>
          <button onClick={onClose} aria-label="Fermer le résumé" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-[13px]"><Loader2 className="w-4 h-4 animate-spin" /> Calcul du résumé…</div>
          ) : isError || !s ? (
            <div role="alert" className="flex flex-col items-center py-10 text-red-600 text-[13px] gap-2">
              <AlertTriangle className="w-5 h-5" /> Impossible de charger le résumé.
              <button onClick={() => refetch()} className="text-[12px] underline">Réessayer</button>
            </div>
          ) : s.total === 0 ? (
            <div className="py-10 text-center text-[13px] text-slate-400">Aucune facture dans cette campagne.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Tile label="Certifiées" g={s.groups.certified} tone="bg-emerald-50 border-emerald-200 text-emerald-800" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
                <Tile label="À analyser" g={s.groups.to_review} tone="bg-amber-50 border-amber-200 text-amber-800" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
                <Tile label="Contrat inconnu" g={s.groups.unknown_contract} tone="bg-red-50 border-red-200 text-red-700" icon={<HelpCircle className="w-3.5 h-3.5" />} />
                <Tile label="FMS indisponible" g={s.groups.fms_unavailable} tone="bg-slate-50 border-slate-200 text-slate-700" icon={<Receipt className="w-3.5 h-3.5" />} />
              </div>

              {s.groups.pending.count > 0 && (
                <p className="text-[12px] text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                  {F(s.groups.pending.count)} facture(s) encore en attente de calcul : le résumé n'est pas définitif.
                </p>
              )}

              <section className="grid sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Sites pris en compte</h4>
                  <dl className="text-[12px] space-y-1">
                    <div className="flex justify-between"><dt className="text-slate-500">Sites rattachés</dt><dd className="font-semibold tabular-nums">{F(s.coverage.sites_rattaches)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Factures avec site</dt><dd className="font-semibold tabular-nums">{F(s.coverage.factures_avec_site)} / {F(s.total)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Mesure Grid disponible</dt><dd className="font-semibold tabular-nums">{F(s.coverage.factures_avec_fms)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Mesure ACM disponible</dt><dd className="font-semibold tabular-nums">{F(s.coverage.factures_avec_acm)}</dd></div>
                  </dl>
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Règle de certification</h4>
                  {Object.keys(s.certified_by_rule).length === 0 ? (
                    <p className="text-[12px] text-slate-400">Aucune facture certifiée.</p>
                  ) : (
                    <dl className="text-[12px] space-y-1">
                      {Object.entries(s.certified_by_rule).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([rule, n]) => (
                        <div key={rule} className="flex justify-between"><dt className="text-slate-500">{RULE_LABEL[rule] ?? rule}</dt><dd className="font-semibold tabular-nums">{F(n ?? 0)}</dd></div>
                      ))}
                    </dl>
                  )}
                  <dl className="text-[12px] space-y-1 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between"><dt className="text-slate-500">Montant incohérent</dt><dd className="font-semibold tabular-nums text-amber-700">{F(s.montant_check.incoherent)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Montant non vérifiable</dt><dd className="font-semibold tabular-nums">{F(s.montant_check.non_verifie)}</dd></div>
                    {s.factures_sans_montant > 0 && (
                      <div className="flex justify-between"><dt className="text-slate-500">Factures sans montant TTC</dt><dd className="font-semibold tabular-nums">{F(s.factures_sans_montant)}</dd></div>
                    )}
                  </dl>
                </div>
              </section>

              {s.top_to_review.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">À traiter en priorité (plus gros montants)</h4>
                    <button onClick={() => go("NEEDS_REVIEW")} className="text-[11px] font-semibold text-slate-600 hover:underline">Voir les contestées</button>
                  </div>
                  <div className="border border-slate-100 rounded-lg overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest">
                        <tr><th className="text-left px-3 py-1.5">Facture</th><th className="text-left px-3 py-1.5">Site</th><th className="text-left px-3 py-1.5">Statut</th><th className="text-right px-3 py-1.5">TTC</th><th className="text-right px-3 py-1.5">Écart montant</th></tr>
                      </thead>
                      <tbody>
                        {s.top_to_review.map(r => (
                          <tr key={r.result_id} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 font-mono">{r.numero_facture}</td>
                            <td className="px-3 py-1.5">{r.site_id ?? "—"}{r.site_name ? <span className="text-slate-400"> · {r.site_name}</span> : null}</td>
                            <td className="px-3 py-1.5">{STATUS_LABEL[r.status] ?? r.status}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{FCFA(r.montant_ttc)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{r.variation_montant_pct == null ? "non calculé" : `${r.variation_montant_pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {s.unknown_contracts_total > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contrats sans site ({F(s.unknown_contracts_total)})</h4>
                    <button onClick={() => go("UNKNOWN_CONTRACT")} className="text-[11px] font-semibold text-slate-600 hover:underline">Voir les factures</button>
                  </div>
                  <p className="text-[12px] text-slate-500 mb-2">Introuvables dans la table contrat → site, les fiches sites et Pilotage Grid : à rattacher pour les certifier.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.unknown_contracts_sample.map(c => <span key={c} className="font-mono text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{c}</span>)}
                    {s.unknown_contracts_total > s.unknown_contracts_sample.length && (
                      <span className="text-[11px] text-slate-400 px-1">+ {F(s.unknown_contracts_total - s.unknown_contracts_sample.length)} autres</span>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
