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
    ChevronRight,
    Tag,
} from 'lucide-react';

export interface PricingPageShellProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    badge?: React.ReactNode;
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

export function PricingPageShell({ title, subtitle, children, badge }: PricingPageShellProps) {
    const { t } = useTranslation();
    const { pathname } = useLocation();

    const activeItem = NAV_ITEMS.find(
        (item) => item.route !== '/pricing'
            ? pathname === item.route || pathname.startsWith(`${item.route}/`)
            : pathname === '/pricing'
    ) ?? NAV_ITEMS[0];

    return (
        <div className="h-full flex flex-col bg-slate-50/60">
            {/* ERP-style header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
                <div className="flex flex-col gap-2.5">
                    {/* Breadcrumbs + Title row */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="hidden sm:flex w-8 h-8 rounded-md bg-gradient-to-br from-sage-500 to-sage-600 items-center justify-center text-white shadow-sm shrink-0">
                                <Tag className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-sm font-bold text-gray-900 truncate">{title}</h1>
                                    {badge}
                                </div>
                                {subtitle && <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>}
                            </div>
                        </div>

                        <nav className="hidden sm:flex items-center gap-1 text-[11px] text-gray-500 shrink-0">
                            <Link to="/dashboard" className="hover:text-sage-600 transition-colors">
                                {t('navigation.dashboard')}
                            </Link>
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            <Link to="/pricing" className="hover:text-sage-600 transition-colors">
                                {t('navigation.pricing')}
                            </Link>
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            <span className="text-gray-700 font-medium">{t(activeItem.labelKey)}</span>
                        </nav>
                    </div>

                    {/* Module sub-navigation - wraps on small screens */}
                    <nav className="flex flex-wrap items-center gap-1">
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.route === '/pricing'
                                ? pathname === '/pricing'
                                : pathname === item.route || pathname.startsWith(`${item.route}/`);
                            return (
                                <Link
                                    key={item.id}
                                    to={item.route}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border',
                                        isActive
                                            ? 'bg-sage-50 text-sage-700 border-sage-200 shadow-sm'
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-transparent'
                                    )}
                                >
                                    <item.icon className={cn('w-3.5 h-3.5', isActive ? 'text-sage-600' : 'text-gray-400')} />
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
