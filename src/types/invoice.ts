export interface Invoice {
  id: number;
  site: number | { id: number; site_id: string; name: string }; // Selon le serializer backend
  site_name?: string; // Si tu reçois juste le nom
  police_number: string;
  contrat_number: string;
  facture_number: string;
  date_facture: string;      // ISO (YYYY-MM-DD)
  date_echeance?: string;    // ISO (YYYY-MM-DD) | null
  montant_ht: number;
  montant_tco?: number;
  montant_redevance?: number;
  montant_tva?: number;
  montant_ttc?: number;
  montant_htva?: number;
  montant_energie?: number;
  montant_cosphi?: number;
  date_ai?: string;          // ISO
  date_ni?: string;          // ISO
  index_ai_k1?: number;
  index_ai_k2?: number;
  index_ni_k1?: number;
  index_ni_k2?: number;
  consommation_kwh?: number;
  rappel_majoration?: number;
  nb_jours?: number;
  ps?: number;
  max_relevee?: number;
  statut?: string;
  observation?: string;
  prime_fixe?: number;
  conso_reactif?: number;
  cos_phi?: number;
  mois_echeance?: string;
  annee_echeance?: number;
  mois_business?: string;
  annee_business?: number;
  type_tarif?: string;
  type_compte?: string;
  numero_compteur?: string;
  created_at?: string; // ISO
}
