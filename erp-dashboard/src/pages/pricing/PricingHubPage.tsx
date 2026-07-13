import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import {
    DollarSign,
    ShieldAlert,
    Package,
    Eye,
    Radio,
    Clock,
    ArrowRight,
} from 'lucide-react';

const CARDS = [
    {
        id: 'priceLists',
        route: '/pricing/price-lists',
        icon: DollarSign,
        color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
        id: 'overrides',
        route: '/pricing/overrides',
        icon: ShieldAlert,
        color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
        id: 'packagingPrices',
        route: '/pricing/packaging-prices',
        icon: Package,
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
        id: 'preview',
        route: '/pricing/preview',
        icon: Eye,
        color: 'bg-purple-50 text-purple-600 border-purple-100',
    },
    {
        id: 'channels',
        route: '/pricing/channels',
        icon: Radio,
        color: 'bg-sage-50 text-sage-600 border-sage-100',
    },
    {
        id: 'chronologies',
        route: '/pricing/chronologies',
        icon: Clock,
        color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
];

export function PricingHubPage() {
    const { t } = useTranslation();

    return (
        <MasterLayout
            mainContent={
                <PricingPageShell
                    title={t('pricing.hub.title')}
                    subtitle={t('pricing.hub.subtitle')}
                >
                    <div className="h-full overflow-y-auto p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl mx-auto">
                            {CARDS.map((card) => (
                                <Link
                                    key={card.id}
                                    to={card.route}
                                    className="group flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-sage-300 transition-all"
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                                        <card.icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-sage-700 transition-colors">
                                            {t(`pricing.${card.id}.title`)}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                            {t(`pricing.${card.id}.description`)}
                                        </p>
                                        <div className="flex items-center gap-1 text-xs text-sage-600 font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {t('common.open')} <ArrowRight className="w-3 h-3" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        <div className="max-w-6xl mx-auto mt-8 p-4 rounded-xl border border-gray-200 bg-white/60">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">{t('pricing.hub.engineTitle')}</h4>
                            <p className="text-xs text-gray-500 leading-relaxed">{t('pricing.hub.engineDescription')}</p>
                        </div>
                    </div>
                </PricingPageShell>
            }
        />
    );
}
