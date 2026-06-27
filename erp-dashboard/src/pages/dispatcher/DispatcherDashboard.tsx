import { useEffect, useState } from 'react';
import {
  Loader2, RefreshCw, ShoppingCart, Package, Truck, AlertTriangle,
  CheckCircle2, ArrowRight, Clock, TrendingUp, XCircle,
  Activity, Box, BarChart3, LayoutGrid, Boxes, Lock, Route, Sparkles, UserCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { useDispatcherDashboard } from '@/hooks/dispatcher/useDispatcherDashboard';
import { useAuth } from '@/context/AuthContext';

// ─── Workspace launch card ──────────────────────────────────────────────────

const WorkspaceCard = ({
  title,
  description,
  icon: Icon,
  gradient,
  metric,
  metricLabel,
  step,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  metric: number;
  metricLabel: string;
  step: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="group relative text-left rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
  >
    <div className={`h-1.5 w-full ${gradient}`} />
    <div className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${gradient} bg-opacity-10 shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1 rounded-full bg-gray-50 border border-gray-100">
          {step}
        </span>
      </div>
      <h3 className="text-sm font-bold text-gray-900 group-hover:text-sage-700 transition-colors">{title}</h3>
      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
        <div>
          <span className="text-2xl font-bold text-gray-900">{metric}</span>
          <span className="text-xs text-gray-400 ml-1.5">{metricLabel}</span>
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-sage-600 group-hover:gap-2 transition-all">
          Ouvrir <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  </button>
);

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
  bg,
  urgent,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  urgent?: boolean;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3.5 transition-all ${
      urgent && value > 0
        ? 'border-red-200 ring-1 ring-red-100 shadow-red-50'
        : 'border-gray-200 hover:border-gray-300 hover:shadow'
    } ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`p-2.5 rounded-xl ${bg} shrink-0`}>
      <Icon className={`w-4.5 h-4.5 ${color}`} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xl font-bold text-gray-900 leading-none">{value}</div>
      <div className="text-xs text-gray-500 mt-1 leading-snug truncate">{label}</div>
    </div>
    {urgent && value > 0 && (
      <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
    )}
  </div>
);

// ─── Alert badge ─────────────────────────────────────────────────────────────

const AlertCard = ({
  label,
  value,
  color,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  onClick?: () => void;
}) => {
  if (value === 0) return null;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${color} ${onClick ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'} transition-all`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-sm font-bold">{value}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
};

// ─── Pipeline stage ───────────────────────────────────────────────────────────

const PipelineStage = ({
  label,
  count,
  color,
  textColor,
  dotColor,
  urgent,
}: {
  label: string;
  count: number;
  color: string;
  textColor: string;
  dotColor: string;
  urgent?: boolean;
}) => (
  <div
    className={`relative flex flex-col items-center justify-center px-3 py-2.5 rounded-xl border min-w-[84px] transition-all ${
      count > 0
        ? `${color} shadow-sm ${urgent ? 'ring-1 ring-red-300' : ''}`
        : 'bg-gray-50 border-gray-100 opacity-50'
    }`}
  >
    {urgent && count > 0 && (
      <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-400 animate-pulse border-2 border-white" />
    )}
    <div className={`text-xl font-bold ${count > 0 ? textColor : 'text-gray-300'}`}>{count}</div>
    <div className="flex items-center gap-1 mt-0.5">
      <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? dotColor : 'bg-gray-300'}`} />
      <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">{label}</span>
    </div>
  </div>
);

const PipelineGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5 shrink-0">
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-0.5">{label}</span>
    <div className="flex items-center gap-1.5">{children}</div>
  </div>
);

const PipelineArrow = () => (
  <div className="flex items-center self-center px-0.5 shrink-0">
    <ArrowRight className="w-4 h-4 text-gray-300" />
  </div>
);

// ─── Dashboard content ────────────────────────────────────────────────────────

const DashboardContent = () => {
  const { data, loading, error, refetch } = useDispatcherDashboard();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    if (!loading && data) setLastUpdated(new Date());
  }, [loading, data]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 gap-3 h-full">
        <Loader2 className="w-7 h-7 animate-spin" />
        <span className="text-sm">Chargement du tableau de bord…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-red-600 font-medium text-sm">{error || 'Données indisponibles'}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-sage-500 text-white text-sm rounded-lg hover:bg-sage-600 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const { pipeline, alerts, activity } = data;
  const hasAlerts = alerts.shortage_queue > 0 || alerts.rejected_bps > 0 || alerts.overdue_deliveries > 0;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  })();

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            <Sparkles className="w-4 h-4 text-amber-400" />
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Vue d'ensemble de la chaîne logistique · Mis à jour {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {/* Alerts banner */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          <AlertCard
            label="rupture(s) en attente de décision"
            value={alerts.shortage_queue}
            color="bg-red-50 border-red-200 text-red-700"
            icon={AlertTriangle}
            onClick={() => navigate('/dispatcher/shortage-queue')}
          />
          <AlertCard
            label="BP rejeté(s) par le magasinier"
            value={alerts.rejected_bps}
            color="bg-orange-50 border-orange-200 text-orange-700"
            icon={XCircle}
          />
          <AlertCard
            label="livraison(s) en retard"
            value={alerts.overdue_deliveries}
            color="bg-amber-50 border-amber-200 text-amber-700"
            icon={Clock}
          />
        </div>
      )}

      {/* Workspaces — primary daily screens */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-700">Espaces de travail</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WorkspaceCard
            title="Workspace Missions"
            description="Regrouper les BC confirmés en mission (rider + véhicule), générer les BL et lancer la préparation."
            icon={Route}
            gradient="bg-sage-500"
            metric={pipeline.bc_confirmed}
            metricLabel="BC en attente"
            step="Étape 1"
            onClick={() => navigate('/dispatcher/workspace/missions')}
          />
          <WorkspaceCard
            title="Bons de livraison"
            description="Allouer les BL confirmés (rupture tolérée, backlog automatique)."
            icon={Boxes}
            gradient="bg-purple-600"
            metric={pipeline.bl_confirmed}
            metricLabel="BL à allouer"
            step="Étape 2"
            onClick={() => navigate('/dispatcher/bons-livraisons')}
          />
          <WorkspaceCard
            title="Moniteur Logistique"
            description="Vue Kanban en lecture seule de toutes les missions de livraison."
            icon={Activity}
            gradient="bg-emerald-600"
            metric={pipeline.missions_draft + pipeline.missions_in_preparation + pipeline.missions_awaiting_shortage_review + pipeline.missions_ready + pipeline.missions_in_transit}
            metricLabel="Missions actives"
            step="Suivi"
            onClick={() => navigate('/dispatcher/monitor')}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-700">Indicateurs clés</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Commandes confirmées"
            value={pipeline.bc_confirmed}
            icon={ShoppingCart}
            color="text-sage-600"
            bg="bg-sage-50"
            urgent={pipeline.bc_confirmed > 0}
            onClick={() => navigate('/dispatcher/orders')}
          />
          <StatCard
            label="File de ruptures"
            value={alerts.shortage_queue}
            icon={AlertTriangle}
            color="text-red-600"
            bg="bg-red-50"
            urgent
            onClick={() => navigate('/dispatcher/shortage-queue')}
          />
          <StatCard
            label="En transit"
            value={pipeline.bl_in_transit}
            icon={Truck}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
          <StatCard
            label="Livrées aujourd'hui"
            value={pipeline.delivered_today}
            icon={TrendingUp}
            color="text-green-600"
            bg="bg-green-50"
          />
        </div>
      </div>

      {/* Full pipeline visualization */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-700">Pipeline logistique complet</span>
        </div>

        <div className="space-y-4">
          {/* Row 1: Entry → Planning */}
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            <PipelineGroup label="Entrée">
              <PipelineStage label="BC confirmés" count={pipeline.bc_confirmed} color="bg-sage-50 border-sage-200" textColor="text-sage-700" dotColor="bg-sage-500" urgent={pipeline.bc_confirmed > 0} />
            </PipelineGroup>
            <PipelineArrow />
            <PipelineGroup label="Missions">
              <PipelineStage label="Brouillon" count={pipeline.missions_draft} color="bg-indigo-50 border-indigo-200" textColor="text-indigo-700" dotColor="bg-indigo-500" />
              <PipelineStage label="En prép." count={pipeline.missions_in_preparation} color="bg-violet-50 border-violet-200" textColor="text-violet-700" dotColor="bg-violet-500" />
              <PipelineStage label="Rupture à examiner" count={pipeline.missions_awaiting_shortage_review} color="bg-red-50 border-red-200" textColor="text-red-700" dotColor="bg-red-500" urgent={pipeline.missions_awaiting_shortage_review > 0} />
              <PipelineStage label="Prêtes" count={pipeline.missions_ready} color="bg-purple-50 border-purple-200" textColor="text-purple-700" dotColor="bg-purple-500" />
              <PipelineStage label="En transit" count={pipeline.missions_in_transit} color="bg-fuchsia-50 border-fuchsia-200" textColor="text-fuchsia-700" dotColor="bg-fuchsia-500" />
            </PipelineGroup>
            <PipelineArrow />
            <PipelineGroup label="BP (magasinier)">
              <PipelineStage label="En attente" count={pipeline.bp_pending} color="bg-yellow-50 border-yellow-200" textColor="text-yellow-700" dotColor="bg-yellow-500" />
              <PipelineStage label="En cours" count={pipeline.bp_in_progress} color="bg-orange-50 border-orange-200" textColor="text-orange-700" dotColor="bg-orange-500" />
              <PipelineStage label="Ruptures" count={pipeline.bp_shortage_queue} color="bg-red-50 border-red-200" textColor="text-red-700" dotColor="bg-red-500" urgent={pipeline.bp_shortage_queue > 0} />
              <PipelineStage label="Rejetés" count={pipeline.bp_rejected} color="bg-rose-50 border-rose-200" textColor="text-rose-700" dotColor="bg-rose-500" urgent={pipeline.bp_rejected > 0} />
            </PipelineGroup>
          </div>

          {/* Row 2: BL + BCH → Delivery */}
          <div className="flex items-stretch gap-2 overflow-x-auto pt-3 border-t border-gray-50">
            <PipelineGroup label="BL">
              <PipelineStage label="Brouillons" count={pipeline.bl_draft} color="bg-gray-50 border-gray-200" textColor="text-gray-700" dotColor="bg-gray-400" />
              <PipelineStage label="Confirmés" count={pipeline.bl_confirmed} color="bg-cyan-50 border-cyan-200" textColor="text-cyan-700" dotColor="bg-cyan-500" />
              <PipelineStage label="Prêts" count={pipeline.bl_ready} color="bg-teal-50 border-teal-200" textColor="text-teal-700" dotColor="bg-teal-500" />
            </PipelineGroup>
            <PipelineArrow />
            <PipelineGroup label="Expédition">
              <PipelineStage label="Chargés" count={pipeline.bl_loaded} color="bg-sky-50 border-sky-200" textColor="text-sky-700" dotColor="bg-sky-500" />
              <PipelineStage label="En transit" count={pipeline.bl_in_transit} color="bg-emerald-50 border-emerald-200" textColor="text-emerald-700" dotColor="bg-emerald-500" />
            </PipelineGroup>
            <PipelineArrow />
            <PipelineGroup label="Résultat">
              <PipelineStage label="Livrées auj." count={pipeline.delivered_today} color="bg-green-50 border-green-200" textColor="text-green-700" dotColor="bg-green-500" />
            </PipelineGroup>
          </div>
        </div>
      </div>

      {/* Activity: recent orders */}
      {activity.recent_orders && activity.recent_orders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-sage-500" />
              <span className="text-sm font-bold text-gray-800">Commandes récentes à dispatcher</span>
            </div>
            <button
              onClick={() => navigate('/dispatcher/orders')}
              className="text-xs font-medium text-sage-600 hover:text-sage-700 flex items-center gap-1"
            >
              Voir tout <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {activity.recent_orders.map((order) => (
              <div
                key={order.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-gray-800 truncate">{order.order_code}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-sage-100 text-sage-700">
                      {order.bc_status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{order.partner.name}</div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className="text-sm font-bold text-gray-900">
                    {Number(order.total_amount).toLocaleString('fr-MA')} Dh
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(order.order_date).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity: active deliveries */}
      {activity.active_deliveries && activity.active_deliveries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-gray-800">Livraisons actives</span>
            <span className="ml-auto text-xs text-gray-400">{activity.active_deliveries.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {activity.active_deliveries.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{d.delivery_number ?? `#${d.id}`}</div>
                  {d.livreur && <div className="text-xs text-gray-400 mt-0.5">{d.livreur.name}</div>}
                </div>
                {d.status && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {d.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity: recent shortages */}
      {activity.recent_shortages && activity.recent_shortages.length > 0 && (
        <div className="bg-white border border-red-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-red-100 flex items-center gap-2 bg-red-50">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold text-red-800">Ruptures récentes</span>
            <button
              onClick={() => navigate('/dispatcher/shortage-queue')}
              className="ml-auto text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              Traiter <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-red-50">
            {activity.recent_shortages.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center gap-3 hover:bg-red-50/50">
                <Box className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{s.bp_number ?? `BP #${s.id}`}</div>
                  {s.deliveryMission && <div className="text-xs text-gray-400 mt-0.5">{s.deliveryMission.mission_number}</div>}
                </div>
                {s.status && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                    {s.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when everything is zero */}
      {pipeline.bc_confirmed === 0 &&
        pipeline.bl_draft === 0 &&
        pipeline.missions_draft === 0 &&
        pipeline.missions_awaiting_shortage_review === 0 &&
        pipeline.bl_in_transit === 0 &&
        !hasAlerts && (
          <div className="text-center py-10 text-gray-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-300" />
            <p className="text-sm font-medium text-gray-500">Pipeline vide — tout est à jour</p>
            <p className="text-xs mt-1">Aucune commande en attente de traitement</p>
          </div>
        )}
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const DispatcherDashboard = () => {
  const navigate = useNavigate();

  const navItems = [
    { label: 'Workspace Missions', href: '/dispatcher/workspace/missions', icon: Route, color: 'text-sage-600 bg-sage-50', desc: 'BC → Mission → BL' },
    { label: 'Moniteur Logistique', href: '/dispatcher/monitor', icon: Activity, color: 'text-emerald-600 bg-emerald-50', desc: 'Kanban lecture seule' },
    { label: 'Commandes (BC)', href: '/dispatcher/orders', icon: ShoppingCart, color: 'text-sky-600 bg-sky-50', desc: 'BCs à dispatcher' },
    { label: 'Bons de livraison', href: '/dispatcher/bons-livraisons', icon: Package, color: 'text-amber-600 bg-amber-50', desc: 'BLs actifs' },
    { label: 'File de ruptures', href: '/dispatcher/shortage-queue', icon: AlertTriangle, color: 'text-red-600 bg-red-50', desc: 'À résoudre' },
    { label: 'Décharges', href: '/dispatcher/decharges', icon: CheckCircle2, color: 'text-green-600 bg-green-50', desc: 'Retours & annulations' },
    { label: 'Transferts entrepôt', href: '/dispatcher/warehouse-transfers', icon: Boxes, color: 'text-teal-600 bg-teal-50', desc: 'Générés automatiquement' },
    { label: 'Flotte & Livreurs', href: '/dispatcher/fleet', icon: UserCircle2, color: 'text-rose-600 bg-rose-50', desc: 'Assignation véhicule' },
  ];

  return (
    <MasterLayout
      leftContent={
        <div className="h-full bg-white border-r border-gray-100 p-4 flex flex-col gap-2 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Navigation rapide</p>
          {navItems.map(({ label, href, icon: Icon, color, desc }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group text-left w-full"
            >
              <div className={`p-2 rounded-lg ${color} shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 truncate">{label}</div>
                <div className="text-xs text-gray-400 truncate">{desc}</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      }
      mainContent={
        <div className="h-full flex flex-col bg-slate-50">
          <DashboardContent />
        </div>
      }
    />
  );
};
