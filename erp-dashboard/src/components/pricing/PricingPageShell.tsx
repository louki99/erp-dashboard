import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    LayoutGrid,
    DollarSign,
    ShieldAlert,
    Package,
    Eye,
    Radio,
    Clock,
} from 'lucide-react';

export interface PricingPageShellProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

const NAV_ITEMS = [
    { id: 'hub', labelKey: 'pricing.hub.title', route: '/pricing', icon: LayoutGrid },
    { id: 'priceLists', labelKey: 'pricing.priceLists.title', route: '/pricing/price-lists', icon: DollarSign },
    { id: 'overrides', labelKey: 'pricing.overrides.title', route: '/pricing/overrides', icon: ShieldAlert },
    { id: 'packagingPrices', labelKey: 'pricing.packagingPrices.title', route: '/pricing/packaging-prices', icon: Package },
    { id: 'preview', labelKey: 'pricing.preview.title', route: '/pricing/preview', icon: Eye },
    { id: 'channels', labelKey: 'pricing.channels.title', route: '/pricing/channels', icon: Radio },
    { id: 'chronologies', labelKey: 'pricing.chronologies.title', route: '/pricing/chronologies', icon: Clock },
];

export function PricingPageShell({ title, subtitle, children }: PricingPageShellProps) {
    const { t } = useTranslation();
    const { pathname } = useLocation();

    return (
        <div className="h-full flex flex-col bg-slate-50/60">
            <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
                        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                    </div>
                    <nav className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
                        {NAV_ITEMS.map((item) => {
                            // Le hub ('/pricing') doit matcher exactement, sinon il resterait actif partout.
                            const isActive = item.route === '/pricing'
                                ? pathname === '/pricing'
                                : pathname === item.route || pathname.startsWith(`${item.route}/`);
                            return (
                                <Link
                                    key={item.id}
                                    to={item.route}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                                        isActive
                                            ? 'bg-sage-50 text-sage-700'
                                            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                    )}
                                >
                                    <item.icon className="w-3.5 h-3.5" />
                                    {t(item.labelKey)}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
