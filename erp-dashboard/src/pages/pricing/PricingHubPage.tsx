import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import {
    DollarSign, ShieldAlert, Package, Eye, Radio, Clock,
    ArrowRight, Zap, TrendingUp,
} from 'lucide-react';
import {
    getPriceLists, getOverrides, getChannels, getBusinessChronologies,
} from '@/services/api/pricingApi';

interface HubStats {
    priceListsTotal: number;
    overridesActive: number;
    channelsActive: number;
    channelsTotal: number;
    chronologiesActive: number;
}

const MODULE_CARDS = [
    {
        id: 'priceLists',
        route: '/pricing/price-lists',
        icon: DollarSign,
        accent: 'bg-blue-50 text-blue-600 border-blue-100',
        countKey: 'priceListsTotal' as keyof HubStats,
    },
    {
        id: 'overrides',
        route: '/pricing/overrides',
        icon: ShieldAlert,
        accent: 'bg-amber-50 text-amber-600 border-amber-100',
        countKey: 'overridesActive' as keyof HubStats,
    },
    {
        id: 'packagingPrices',
        route: '/pricing/packaging-prices',
        icon: Package,
        accent: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        countKey: null,
    },
    {
        id: 'preview',
        route: '/pricing/preview',
        icon: Eye,
        accent: 'bg-purple-50 text-purple-600 border-purple-100',
        countKey: null,
    },
    {
        id: 'channels',
        route: '/pricing/channels',
        icon: Radio,
        accent: 'bg-sage-50 text-sage-600 border-sage-100',
        countKey: 'channelsActive' as keyof HubStats,
    },
    {
        id: 'chronologies',
        route: '/pricing/chronologies',
        icon: Clock,
        accent: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        countKey: 'chronologiesActive' as keyof HubStats,
    },
];

const V5_SOURCES = ['partner_override', 'partner_override_discount', 'tier', 'override', 'standard', 'linear'];

export function PricingHubPage() {
    const { t } = useTranslation();
    const [stats, setStats] = useState<HubStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        Promise.allSettled([
            getPriceLists({ page: 1, per_page: 1 }),
            getOverrides({ page: 1, per_page: 1, active: true }),
            getChannels(),
            getBusinessChronologies(),
        ]).then(([plRes, ovRes, chRes, chronoRes]) => {
            setStats({
                priceListsTotal: plRes.status === 'fulfilled' ? (plRes.value.total ?? 0) : 0,
                overridesActive: ovRes.status === 'fulfilled' ? (ovRes.value.overrides.total ?? 0) : 0,
                channelsActive: chRes.status === 'fulfilled' ? chRes.value.filter((c) => c.is_active).length : 0,
                channelsTotal: chRes.status === 'fulfilled' ? chRes.value.length : 0,
                chronologiesActive: chronoRes.status === 'fulfilled' ? chronoRes.value.filter((c) => c.is_active).length : 0,
            });
        }).finally(() => setStatsLoading(false));
    }, []);

    const kpiItems = useMemo(() => [
        {
            label: t('pricing.hub.stats.priceLists'),
            value: stats?.priceListsTotal,
            icon: DollarSign,
            color: 'text-blue-600 bg-blue-50 border-blue-100',
        },
        {
            label: t('pricing.hub.stats.activeOverrides'),
            value: stats?.overridesActive,
            icon: ShieldAlert,
            color: 'text-amber-600 bg-amber-50 border-amber-100',
        },
        {
            label: t('pricing.hub.stats.activeChannels'),
            value: stats ? `${stats.channelsActive} / ${stats.channelsTotal}` : undefined,
            icon: Radio,
            color: 'text-sage-600 bg-sage-50 border-sage-100',
        },
        {
            label: t('pricing.hub.stats.activeChronologies'),
            value: stats?.chronologiesActive,
            icon: Clock,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        },
    ], [stats, t]);

    return (
        <MasterLayout
            mainContent={
                <PricingPageShell
                    title={t('pricing.hub.title')}
                    subtitle={t('pricing.hub.subtitle')}
                >
                    <div className="h-full overflow-y-auto p-6">
                        <div className="max-w-6xl mx-auto space-y-6">

                            {/* KPI Row */}
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                                {kpiItems.map((kpi) => (
                                    <div
                                        key={kpi.label}
                                        className={`bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm ${kpi.color.split(' ').find(c => c.startsWith('border')) ?? 'border-gray-100'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${kpi.color}`}>
                                            <kpi.icon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-gray-500 leading-tight">{kpi.label}</p>
                                            <p className={`text-xl font-bold mt-0.5 transition-colors ${statsLoading ? 'text-gray-200 animate-pulse' : 'text-gray-900'}`}>
                                                {statsLoading ? '···' : (kpi.value ?? '—')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Module Cards */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('pricing.hub.modules')}</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {MODULE_CARDS.map((card) => {
                                        const count = card.countKey && stats ? stats[card.countKey] : null;
                                        return (
                                            <Link
                                                key={card.id}
                                                to={card.route}
                                                className="group flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-sage-300 transition-all"
                                            >
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
                                                    <card.icon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-sage-700 transition-colors">
                                                            {t(`pricing.${card.id}.title`)}
                                                        </h3>
                                                        {count !== null && !statsLoading && (
                                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${card.accent}`}>
                                                                {count}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                                                        {t(`pricing.${card.id}.description`)}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-xs text-sage-600 font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {t('common.open')} <ArrowRight className="w-3 h-3" />
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Engine v5 Info */}
                            <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center shrink-0 shadow-sm">
                                        <Zap className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-xs font-semibold text-gray-900 mb-1">{t('pricing.hub.engineTitle')}</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed">{t('pricing.hub.engineDescription')}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {V5_SOURCES.map((src) => (
                                                <span
                                                    key={src}
                                                    className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200"
                                                >
                                                    {src}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </PricingPageShell>
            }
        />
    );
}
