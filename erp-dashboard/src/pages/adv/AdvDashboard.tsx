import {
    Users,
    FileCheck,
    AlertTriangle,
    TrendingUp,
    CheckCircle2,
    Ban,
    Loader2,
    Clock,
    ShieldAlert,
    ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { useAdvDashboard } from '@/hooks/adv/useAdvDashboard';
import { TaskWidget } from '@/components/tasks';
import { cn } from '@/lib/utils';
import type { DashboardStats, Partner } from '@/types/adv.types';

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
    label: string;
    value: string | number;
    badge?: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    onClick?: () => void;
    alert?: boolean;
}

const KpiCard = ({ label, value, badge, icon: Icon, iconBg, iconColor, onClick, alert }: KpiCardProps) => (
    <button
        onClick={onClick}
        disabled={!onClick}
        className={cn(
            'w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-5 transition-all duration-200',
            onClick ? 'hover:shadow-md hover:border-gray-300 cursor-pointer' : 'cursor-default',
            alert && 'border-l-4 border-l-red-500',
        )}
    >
        <div className="flex justify-between items-start mb-4">
            <div className={cn('p-3 rounded-xl', iconBg)}>
                <Icon className={cn('w-5 h-5', iconColor)} />
            </div>
            {badge && (
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    {badge}
                </span>
            )}
        </div>
        <div className="space-y-0.5">
            <p className="text-3xl font-black text-gray-900 tracking-tight">{value}</p>
            <p className="text-sm text-gray-500 font-medium">{label}</p>
        </div>
    </button>
);

// ─── Credit Alert Row ─────────────────────────────────────────────────────────

const CreditAlertRow = ({ partner }: { partner: Partner }) => {
    const limit = Number(partner.credit_limit || 0);
    const used = Number(partner.credit_used || 0);
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

    return (
        <div className="flex gap-3 items-start py-2.5 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{partner.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{partner.code}</p>
                <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                        className={cn(
                            'h-full rounded-full transition-all',
                            pct >= 100 ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-emerald-500',
                        )}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className="text-xs font-bold text-red-600">{pct.toFixed(0)}%</p>
                <p className="text-[10px] text-gray-400">{used.toLocaleString('fr-FR')} Dh</p>
            </div>
        </div>
    );
};

// ─── Recent Partner Row ───────────────────────────────────────────────────────

const RecentPartnerRow = ({ partner, onNavigate }: { partner: Partner; onNavigate: () => void }) => (
    <button
        onClick={onNavigate}
        className="w-full flex gap-3 items-center py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded px-1 transition-colors text-left"
    >
        <div className="w-8 h-8 bg-gradient-to-br from-sage-400 to-sage-500 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
            {partner.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{partner.name}</p>
            <p className="text-xs text-gray-400">{partner.code}</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 shrink-0">
            PENDING
        </span>
    </button>
);

// ─── Dashboard Content ────────────────────────────────────────────────────────

const AdvDashboardContent = () => {
    const { data, loading, error, refetch } = useAdvDashboard();
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-sage-500" />
                <p className="text-sm">Chargement du tableau de bord...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-4 text-sm">{error || 'Données indisponibles'}</p>
                <button
                    onClick={refetch}
                    className="px-4 py-2 bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors text-sm font-medium"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    const stats: DashboardStats = {
        pending_partners: data.stats?.pending_partners ?? 0,
        pending_review: data.stats?.pending_review ?? 0,
        on_hold: data.stats?.on_hold ?? 0,
        pending_derogations: data.stats?.pending_derogations ?? 0,
        confirmed_today: data.stats?.confirmed_today ?? 0,
        blocked_partners: data.stats?.blocked_partners ?? 0,
        total_credit_exposure: data.stats?.total_credit_exposure ?? 0,
        available_credit: data.stats?.available_credit ?? 0,
    };

    const creditAlerts = Array.isArray(data.creditAlerts) ? data.creditAlerts : [];
    const recentPartners = Array.isArray(data.recentPartners) ? data.recentPartners : [];

    const n = (v: unknown): number => (v != null && v !== '' ? Number(v) : 0);

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tableau de bord ADV</h1>
                    <p className="text-gray-500 mt-0.5 text-sm">
                        Administration des ventes — supervision du risque client
                    </p>
                </div>
                <button
                    onClick={refetch}
                    className="px-4 py-2 bg-sage-600 text-white rounded-lg shadow-sm hover:bg-sage-700 transition-colors text-sm font-medium"
                >
                    Rafraîchir
                </button>
            </div>

            {/* KPI Grid — 6 cards matching the API fields */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard
                    label="À valider"
                    value={n(stats.pending_review)}
                    badge="BCs"
                    icon={FileCheck}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                    onClick={() => navigate('/adv/validation')}
                    alert={n(stats.pending_review) > 0}
                />
                <KpiCard
                    label="En attente"
                    value={n(stats.on_hold)}
                    badge="BCs"
                    icon={Clock}
                    iconBg="bg-orange-100"
                    iconColor="text-orange-600"
                    onClick={() => navigate('/adv/validation')}
                />
                <KpiCard
                    label="Dérogations"
                    value={n(stats.pending_derogations)}
                    badge="Crédit"
                    icon={ShieldAlert}
                    iconBg="bg-purple-100"
                    iconColor="text-purple-600"
                    onClick={() => navigate('/adv/derogations')}
                    alert={n(stats.pending_derogations) > 0}
                />
                <KpiCard
                    label="Validés aujourd'hui"
                    value={n(stats.confirmed_today)}
                    badge="BCs"
                    icon={CheckCircle2}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                />
                <KpiCard
                    label="Tiers en attente"
                    value={n(stats.pending_partners)}
                    badge="Partenaires"
                    icon={Users}
                    iconBg="bg-sage-100"
                    iconColor="text-sage-600"
                    onClick={() => navigate('/adv/partners')}
                    alert={n(stats.pending_partners) > 0}
                />
                <KpiCard
                    label="Partenaires bloqués"
                    value={n(stats.blocked_partners)}
                    badge="Crédit"
                    icon={Ban}
                    iconBg="bg-red-100"
                    iconColor="text-red-600"
                    onClick={() => navigate('/adv/credit')}
                    alert={n(stats.blocked_partners) > 0}
                />
            </div>

            {/* Encours global banner */}
            <div className="bg-gradient-to-r from-slate-800 to-sage-900 rounded-xl p-5 text-white flex items-center justify-between shadow-lg">
                <div>
                    <p className="text-sage-300 text-xs font-medium uppercase tracking-wider mb-1">Encours Global</p>
                    <p className="text-3xl font-black">{n(stats.total_credit_exposure).toLocaleString('fr-FR')} Dh</p>
                </div>
                <div className="text-right">
                    <p className="text-sage-300 text-xs font-medium uppercase tracking-wider mb-1">Crédit Disponible</p>
                    <p className="text-2xl font-bold text-emerald-300">{n(stats.available_credit).toLocaleString('fr-FR')} Dh</p>
                </div>
                <button
                    onClick={() => navigate('/adv/credit')}
                    className="ml-6 flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors"
                >
                    Console Crédit <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                    <TaskWidget
                        workflowType="bc"
                        title="Tâches de validation BC"
                        maxTasks={5}
                        showViewAll={true}
                    />

                    {/* Recent Partners to validate */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900 text-sm">Nouveaux Partenaires</h3>
                            <button
                                onClick={() => navigate('/adv/partners')}
                                className="text-xs text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1"
                            >
                                Voir tout <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="px-5 py-1">
                            {recentPartners.length > 0 ? (
                                recentPartners.slice(0, 5).map((partner) => (
                                    <RecentPartnerRow
                                        key={partner.id}
                                        partner={partner}
                                        onNavigate={() => navigate('/adv/partners')}
                                    />
                                ))
                            ) : (
                                <div className="py-8 text-center text-gray-400">
                                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                                    <p className="text-sm">Aucun nouveau partenaire en attente.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right — Credit Alerts + Écheances CTA */}
                <div className="space-y-5">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 bg-amber-50/60">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <h3 className="font-semibold text-gray-900 text-sm">Alertes Crédit</h3>
                        </div>
                        <div className="px-5 py-1">
                            {creditAlerts.length > 0 ? (
                                creditAlerts.slice(0, 6).map((alert) => (
                                    <CreditAlertRow key={alert.id} partner={alert} />
                                ))
                            ) : (
                                <div className="py-6 text-center text-gray-400">
                                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                    <p className="text-sm">Aucune alerte crédit active.</p>
                                </div>
                            )}
                        </div>
                        {creditAlerts.length > 0 && (
                            <div className="px-5 py-3 border-t border-gray-100">
                                <button
                                    onClick={() => navigate('/adv/credit')}
                                    className="w-full text-xs text-sage-600 hover:text-sage-700 font-medium flex items-center justify-center gap-1"
                                >
                                    Gérer le crédit <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/adv/echeances')}
                        className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-gray-300 transition-all text-left"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-red-100 rounded-xl">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 text-sm">Échéances en Retard</p>
                                <p className="text-xs text-gray-500 mt-0.5">Factures impayées à surveiller</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>Voir les échéances</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/adv/derogations')}
                        className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-gray-300 transition-all text-left"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-purple-100 rounded-xl">
                                <ShieldAlert className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 text-sm">Dérogations de Crédit</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {n(stats.pending_derogations)} en attente d'approbation
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>Gérer les dérogations</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AdvDashboard = () => {
    return (
        <MasterLayout
            leftContent={
                <div className="bg-white h-full p-5 border-r border-gray-100 space-y-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Accès Rapide</p>
                    {[
                        { label: 'Validation BC', path: '/adv/validation', icon: FileCheck },
                        { label: 'Partenaires', path: '/adv/partners', icon: Users },
                        { label: 'Crédit', path: '/adv/credit', icon: TrendingUp },
                        { label: 'Échéances', path: '/adv/echeances', icon: Clock },
                        { label: 'Dérogations', path: '/adv/derogations', icon: ShieldAlert },
                    ].map(({ label, path, icon: Icon }) => (
                        <QuickLink key={path} label={label} path={path} icon={Icon} />
                    ))}
                </div>
            }
            mainContent={
                <div className="h-full overflow-y-auto bg-slate-50">
                    <AdvDashboardContent />
                </div>
            }
        />
    );
};

const QuickLink = ({ label, path, icon: Icon }: { label: string; path: string; icon: React.ElementType }) => {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(path)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-sage-50 hover:text-sage-700 transition-colors text-sm font-medium"
        >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
        </button>
    );
};
