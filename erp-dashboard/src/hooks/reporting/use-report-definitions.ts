import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/services/api/client';
import { ENDPOINTS } from '@/config/apiConfig';
import type { ReportDefinitionAdmin, ReportDefinitionPayload, SourceView } from '@/types/reports.types';

const ADMIN_KEY = ['reporting', 'admin', 'definitions'] as const;

// ── List (all, including inactive) ───────────────────────────────────────────

export const useAdminDefinitions = () =>
  useQuery({
    queryKey: ADMIN_KEY,
    queryFn: async (): Promise<ReportDefinitionAdmin[]> => {
      const { data } = await apiClient.get(ENDPOINTS.REPORTING_ADMIN_DEFINITIONS);
      return (data as any)?.data ?? data;
    },
  });

// ── Available source views dropdown ──────────────────────────────────────────

// Fallback used if /admin/sources is not yet deployed
export const KNOWN_VIEWS: SourceView[] = [
  { view: 'vw_clients_summary',     category: 'clients',  label: 'Clients — Résumé',             description: 'Liste clients avec solde, plafond crédit et statut',   columns: ['id','code','name','category','region','city','credit_limit','current_balance','status'] },
  { view: 'vw_client_balances',     category: 'clients',  label: 'Clients — Balances',           description: 'Soldes et mouvements par client',                       columns: ['client_id','code','name','balance','overdue','last_payment'] },
  { view: 'vw_credit_aging',        category: 'clients',  label: 'Clients — Aging crédit',       description: 'Créances par tranche d\'échéance',                      columns: ['client_id','code','name','0_30','31_60','61_90','90_plus'] },
  { view: 'vw_products_catalog',    category: 'products', label: 'Produits — Catalogue',         description: 'Catalogue complet des produits avec tarifs',            columns: ['id','code','name','family','unit','price','stock'] },
  { view: 'vw_stock_levels',        category: 'products', label: 'Stock — Niveaux',              description: 'Niveaux de stock actuels par produit',                  columns: ['product_id','code','name','warehouse','qty','min_qty','status'] },
  { view: 'vw_stock_movements',     category: 'products', label: 'Stock — Mouvements',           description: 'Historique des mouvements de stock',                    columns: ['date','product_code','product_name','type','qty','warehouse','ref'] },
  { view: 'vw_price_lists_active',  category: 'price_lists', label: 'Tarifs — Listes actives',  description: 'Tarifs actifs avec conditions',                         columns: ['id','code','name','currency','valid_from','valid_to'] },
  { view: 'vw_price_list_lines',    category: 'price_lists', label: 'Tarifs — Lignes',          description: 'Lignes de tarifs par produit',                          columns: ['list_code','product_code','product_name','price','discount'] },
  { view: 'vw_sales_by_salesperson',category: 'sales',   label: 'Ventes — Par commercial',      description: 'CA et commandes par commercial',                        columns: ['salesperson','orders_count','total_ht','total_ttc','avg_order'] },
  { view: 'vw_sales_by_product',    category: 'sales',   label: 'Ventes — Par produit',          description: 'Ventes et quantités par produit',                       columns: ['product_code','product_name','qty_sold','total_ht','orders_count'] },
  { view: 'vw_sales_by_client',     category: 'sales',   label: 'Ventes — Par client',           description: 'CA et commandes par client',                           columns: ['client_code','client_name','orders_count','total_ht','last_order_date'] },
  { view: 'vw_invoices_list',       category: 'sales',   label: 'Ventes — Factures',             description: 'Liste des factures avec statut de paiement',           columns: ['ref','date','client_name','total_ht','total_ttc','status','due_date'] },
  { view: 'vw_visits_summary',      category: 'visits',  label: 'Visites — Résumé',              description: 'Résumé des visites par commercial',                     columns: ['salesperson','visits_count','orders_count','conversion_rate','period'] },
  { view: 'vw_visits_detail',       category: 'visits',  label: 'Visites — Détail',              description: 'Détail de chaque visite client',                        columns: ['date','salesperson','client_name','type','duration','outcome','notes'] },
  { view: 'vw_visit_actions',       category: 'visits',  label: 'Visites — Actions',             description: 'Actions de suivi issues des visites',                  columns: ['visit_date','client_name','action','due_date','status','owner'] },
  { view: 'vw_delivery_performance',category: 'delivery',label: 'Livraisons — Performance',     description: 'Taux de service et délais de livraison',               columns: ['period','deliveries_count','on_time','delayed','avg_delay_days'] },
  { view: 'vw_delivery_notes_list', category: 'delivery',label: 'Livraisons — Bons',            description: 'Liste des bons de livraison',                           columns: ['ref','date','client_name','driver','status','lines_count'] },
  { view: 'vw_payments_received',   category: 'treasury',label: 'Trésorerie — Encaissements',   description: 'Paiements reçus par mode et période',                  columns: ['date','client_name','amount','method','ref','bank'] },
  { view: 'vw_outstanding_invoices',category: 'treasury',label: 'Trésorerie — Impayés',         description: 'Factures échues non réglées',                          columns: ['ref','client_name','total_ttc','due_date','overdue_days','salesperson'] },
];

export const useAdminSources = () =>
  useQuery({
    queryKey: ['reporting', 'admin', 'sources'],
    queryFn: async (): Promise<SourceView[]> => {
      try {
        const { data } = await apiClient.get(ENDPOINTS.REPORTING_ADMIN_SOURCES);
        return (data as any)?.data ?? data;
      } catch {
        return KNOWN_VIEWS;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

// ── Create ────────────────────────────────────────────────────────────────────

export const useCreateDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ReportDefinitionPayload): Promise<ReportDefinitionAdmin> => {
      const { data } = await apiClient.post(ENDPOINTS.REPORTING_ADMIN_DEFINITIONS, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ['reporting', 'definitions'] });
      toast.success('Rapport créé avec succès.');
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur lors de la création.'),
  });
};

// ── Update ────────────────────────────────────────────────────────────────────

export const useUpdateDefinition = (code: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ReportDefinitionPayload>): Promise<ReportDefinitionAdmin> => {
      const { data } = await apiClient.put(
        `${ENDPOINTS.REPORTING_ADMIN_DEFINITIONS}/${code}`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ['reporting', 'definitions'] });
      toast.success('Rapport mis à jour.');
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur lors de la mise à jour.'),
  });
};

// ── Toggle active/inactive ────────────────────────────────────────────────────

export const useToggleDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<ReportDefinitionAdmin> => {
      const { data } = await apiClient.patch(
        `${ENDPOINTS.REPORTING_ADMIN_DEFINITIONS}/${code}/toggle`,
      );
      return data;
    },
    onSuccess: (def) => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ['reporting', 'definitions'] });
      toast.success(def.is_active ? 'Rapport activé.' : 'Rapport désactivé.');
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur lors du changement de statut.'),
  });
};

// ── Delete ────────────────────────────────────────────────────────────────────

export const useDeleteDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<void> => {
      await apiClient.delete(`${ENDPOINTS.REPORTING_ADMIN_DEFINITIONS}/${code}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ['reporting', 'definitions'] });
      toast.success('Rapport supprimé.');
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur lors de la suppression.'),
  });
};
