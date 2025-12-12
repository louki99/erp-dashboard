import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
    Search,
    Calendar,
    User,
    Building,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    CreditCard,
    FileText,
    Package,
    Loader2,
    Settings,
    Printer,
    Download,
    Share2,
    MoreVertical
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { type ColDef, ModuleRegistry, ClientSideRowModelModule, ValidationModule } from 'ag-grid-community';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { DataGrid } from '@/components/common/DataGrid';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { cn } from '@/lib/utils';

// Register Ag-Grid Modules
ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule]);

// --- Types ---
interface Partner {
    id: number;
    name: string;
    code: string;
    credit_limit: string;
    credit_used: string;
    credit_available: string;
    credit_hold: boolean;
    tax_number_ice: string;
    city: string | null;
}

interface Product {
    id: number;
    name: string;
    code: string;
    stock?: number;
    quantity: number;
}

interface OrderProduct {
    order_id: number;
    product_id: number;
    quantity: number;
    price: string;
    total_price: string;
    unit: string;
    product: Product;
}

interface BC {
    id: number;
    bc_number: string;
    order_code: string;
    created_at: string;
    total_amount: string;
    payment_status: string;
    order_status: string;
    is_urgent: boolean;
    is_overdue: boolean;
    items_count: number;
    partner: Partner;
    order_products: OrderProduct[];
}

interface ApiResponse {
    bcs: {
        data: BC[];
        current_page: number;
        total: number;
    };
    stats: {
        pending_review: number;
    };
}

// --- Action Panel Component ---

const ActionGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-2 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 relative">
        {children}
    </div>
);

interface ActionItemProps {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    variant?: 'default' | 'danger' | 'primary' | 'sage' | 'warning';
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default' }: ActionItemProps) => {
    const variants = {
        default: "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
        danger: "text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10",
        primary: "text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10",
        sage: "text-sage-500 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-200 hover:bg-sage-50 dark:hover:bg-sage-900/20",
        warning: "text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20"
    };

    return (
        <button
            onClick={onClick}
            className={cn(
                "group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto",
                variants[variant]
            )}
        >
            <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg translate-x-1 group-hover:translate-x-0">
                {label}
                <span className="absolute top-1/2 -translate-y-1/2 -right-1 border-4 border-transparent border-l-gray-900"></span>
            </span>
        </button>
    );
};

const AdvActionPanel = () => {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40 transition-all duration-300">
            <ActionGroup>
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-sage-500 rounded-full opacity-50"></div>
                </div>
                <ActionItem icon={CheckCircle} label="Valider BC" variant="sage" />
                <ActionItem icon={XCircle} label="Rejeter" variant="danger" />
                <ActionItem icon={Clock} label="Mettre en attente" variant="warning" />
            </ActionGroup>

            <ActionGroup>
                <ActionItem icon={Printer} label="Imprimer" variant="default" />
                <ActionItem icon={Download} label="Exporter PDF" variant="default" />
                <ActionItem icon={Share2} label="Partager" variant="primary" />
            </ActionGroup>

            <div className="mt-auto pb-4">
                <ActionGroup>
                    <ActionItem icon={Settings} label="Paramètres" variant="default" />
                </ActionGroup>
            </div>
        </div>
    );
};

// --- Detail Components ---

const OrderLinesContent = ({ lines }: { lines: OrderProduct[] }) => {
    const columnDefs: ColDef[] = [
        {
            headerName: 'Code',
            field: 'product.code',
            width: 130,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-500">{params.value}</span>
                </div>
            )
        },
        {
            headerName: 'Article',
            field: 'product.name',
            flex: 2,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{params.value}</span>
                </div>
            )
        },
        {
            headerName: 'Qté',
            field: 'quantity',
            width: 100,
            cellClass: 'text-right',
            valueFormatter: (params: any) => `${params.value} ${params.data.unit}`
        },
        {
            headerName: 'Prix (Dh)',
            field: 'price',
            width: 120,
            cellClass: 'text-right',
            valueFormatter: (params: any) => parseFloat(params.value).toLocaleString()
        },
        {
            headerName: 'Total (Dh)',
            field: 'total_price',
            width: 120,
            cellClass: 'text-right',
            valueFormatter: (params: any) => {
                const val = params.value || (params.data.quantity * parseFloat(params.data.price)).toString();
                return parseFloat(val).toLocaleString();
            }
        },
        {
            headerName: 'Dispo',
            width: 100,
            cellRenderer: (params: any) => {
                const item = params.data;
                const isAvailable = (item.product.quantity || 0) > item.quantity;
                return (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isAvailable
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {isAvailable ? 'OK' : 'Manquant'}
                    </span>
                );
            },
            cellStyle: { display: 'flex', justifyContent: 'center', alignItems: 'center' }
        }
    ];

    return (
        <div className="h-96 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm ag-theme-alpine dark:ag-theme-alpine-dark">
            <AgGridReact
                rowData={lines}
                columnDefs={columnDefs}
                defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true,
                }}
                pagination={true}
                paginationPageSize={10}
                headerHeight={40}
                rowHeight={40}
            />
        </div>
    );
};

const ClientInfoContent = ({ partner }: { partner: Partner }) => {
    const creditLimit = parseFloat(partner.credit_limit || '0');
    const creditUsed = parseFloat(partner.credit_used || '0');
    const creditAvailable = parseFloat(partner.credit_available || '0');
    const creditUtilization = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations Générales</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Code Client</span>
                            <span className="font-medium">{partner.code}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Raison Sociale</span>
                            <span className="font-medium">{partner.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">ICE</span>
                            <span className="font-medium">{partner.tax_number_ice || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Ville</span>
                            <span className="font-medium">{partner.city || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Situation Financière</h3>

                    <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span>Utilisation Crédit</span>
                            <span>{creditUtilization.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={`h-full ${creditUtilization > 100 ? 'bg-red-500' : creditUtilization > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs font-medium mt-1">
                            <span className={creditUtilization > 100 ? 'text-red-600' : 'text-emerald-600'}>
                                {creditUsed.toLocaleString()} Dh Utilisés
                            </span>
                            <span className="text-gray-400">
                                Plafond: {creditLimit.toLocaleString()} Dh
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800">
                            <div className="text-xs text-gray-500 mb-1">Crédit Disponible</div>
                            <div className="text-lg font-bold text-emerald-600">{creditAvailable.toLocaleString()} Dh</div>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800">
                            <div className="text-xs text-gray-500 mb-1">Statut</div>
                            <div className={`text-lg font-bold ${partner.credit_hold ? 'text-red-600' : 'text-emerald-600'}`}>
                                {partner.credit_hold ? 'Bloqué' : 'Normal'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StockAnalysisContent = ({ bc }: { bc: BC }) => {
    // Calculate stock statistics
    const totalItems = bc.order_products.length;
    const availableItems = bc.order_products.filter(p => (p.product.quantity || 0) >= p.quantity).length;
    const partialItems = bc.order_products.filter(p => (p.product.quantity || 0) > 0 && (p.product.quantity || 0) < p.quantity).length;
    const outOfStockItems = totalItems - availableItems - partialItems;

    return (
        <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-full text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{availableItems}</div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-500">Articles Disponibles</div>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{partialItems}</div>
                            <div className="text-xs text-amber-600 dark:text-amber-500">Disponibilité Partielle</div>
                        </div>
                    </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400">
                            <XCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{outOfStockItems}</div>
                            <div className="text-xs text-red-600 dark:text-red-500">Rupture de Stock</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold mb-3">Détail des ruptures</h3>
                {outOfStockItems === 0 && partialItems === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                        <p>Tous les articles sont disponibles</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {bc.order_products.filter(p => (p.product.quantity || 0) < p.quantity).map(item => (
                            <div key={item.product_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs font-bold">
                                        {item.product.code.substring(0, 2)}
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm">{item.product.name}</div>
                                        <div className="text-xs text-gray-500">{item.product.code}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-red-600">
                                        {(item.product.quantity || 0)} / {item.quantity}
                                    </div>
                                    <div className="text-xs text-gray-400">En stock / Demandé</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const BcDetailView = ({ bc }: { bc: BC }) => {
    const tabs: TabItem[] = [
        { id: 'lines', label: 'Lignes de Commande', icon: FileText },
        { id: 'client', label: 'Info Client & Crédit', icon: User },
        { id: 'stock', label: 'Analyse Stock', icon: Package },
    ];

    const [activeTab, setActiveTab] = useState('lines');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        lines: true,
        client: true,
        stock: true
    });

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    // Scroll Spy Logic
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (isScrollingRef.current) return;

            const containerTop = container.scrollTop;
            for (const tab of tabs) {
                const el = sectionRefs.current[tab.id];
                if (!el || !openSections[tab.id]) continue;

                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;

                if (elTop <= containerTop + 100 && elBottom > containerTop + 50) {
                    if (activeTab !== tab.id) {
                        setActiveTab(tab.id);
                    }
                    break;
                }
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [openSections, tabs, activeTab]);

    const handleTabChange = (id: string) => {
        setActiveTab(id);
        isScrollingRef.current = true;

        if (!openSections[id]) {
            setOpenSections(prev => ({ ...prev, [id]: true }));
        }

        setTimeout(() => {
            const el = sectionRefs.current[id];
            const container = containerRef.current;

            if (el && container) {
                const elementTop = el.offsetTop;
                container.scrollTo({
                    top: elementTop - container.offsetTop,
                    behavior: 'smooth'
                });
            }
            setTimeout(() => { isScrollingRef.current = false; }, 600);
        }, 100);
    };

    const toggleSection = (id: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [id]: isOpen }));
    };

    const handleExpandAll = () => {
        const allOpen = tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: true }), {});
        setOpenSections(allOpen);
    };

    const handleCollapseAll = () => {
        const allClosed = tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: false }), {});
        setOpenSections(allClosed);
    };

    if (!bc) return <div className="p-10 text-center text-gray-400">Sélectionnez une commande</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-black/20 overflow-hidden">
            {/* Header Sticky */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6 sticky top-0 z-20">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            {bc.bc_number} <span className="text-gray-400 font-normal text-lg">/ {bc.order_code}</span>
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(bc.created_at).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><Building className="w-4 h-4" /> {bc.partner.name}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-sage-600 dark:text-sage-400">
                            {parseFloat(bc.total_amount).toLocaleString()} <span className="text-sm font-normal text-gray-400">Dh TTC</span>
                        </div>
                        <div className="mt-2 flex justify-end gap-2 items-center">
                            {bc.is_urgent && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">URGENT</span>}

                            {/* Contrôles Rapides Badges */}
                            {bc.partner.credit_hold ? (
                                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> CRÉDIT BLOQUÉ
                                </span>
                            ) : (
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> CRÉDIT OK
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-10">
                <SageTabs
                    tabs={tabs}
                    activeTabId={activeTab}
                    onTabChange={handleTabChange}
                    onExpandAll={handleExpandAll}
                    onCollapseAll={handleCollapseAll}
                    className="px-6 shadow-none"
                />
            </div>

            {/* Content Area */}
            <div ref={containerRef} className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">

                <div ref={el => { sectionRefs.current['lines'] = el; }}>
                    <SageCollapsible
                        title="Lignes de Commande"
                        isOpen={openSections['lines']}
                        onOpenChange={(open) => toggleSection('lines', open)}
                    >
                        <OrderLinesContent lines={bc.order_products} />
                    </SageCollapsible>
                </div>

                <div ref={el => { sectionRefs.current['client'] = el; }}>
                    <SageCollapsible
                        title="Info Client & Crédit"
                        isOpen={openSections['client']}
                        onOpenChange={(open) => toggleSection('client', open)}
                    >
                        <ClientInfoContent partner={bc.partner} />
                    </SageCollapsible>
                </div>

                <div ref={el => { sectionRefs.current['stock'] = el; }}>
                    <SageCollapsible
                        title="Analyse Stock"
                        isOpen={openSections['stock']}
                        onOpenChange={(open) => toggleSection('stock', open)}
                    >
                        <StockAnalysisContent bc={bc} />
                    </SageCollapsible>
                </div>
            </div>
        </div>
    );
};

export const AdvValidationPage = () => {
    const [bcs, setBcs] = useState<BC[]>([]);
    const [selectedBcId, setSelectedBcId] = useState<string | null>(null);
    const [selectedBcDetails, setSelectedBcDetails] = useState<BC | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [detailLoading, setDetailLoading] = useState<boolean>(false);

    const fetchBcDetails = async (id: string) => {
        setDetailLoading(true);
        try {
            const response = await axios.get<ApiResponse>(`http://localhost:8000/api/backend/adv/bc/${id}`);
            if (response.data?.bc) {
                setSelectedBcDetails(response.data.bc);
            }
        } catch (error) {
            console.error("Failed to fetch BC details", error);
            setSelectedBcDetails(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await axios.get<ApiResponse>('http://localhost:8000/api/backend/adv/bc');
            if (response.data?.bcs?.data) {
                setBcs(response.data.bcs.data);
                // Optionally select the first one if none selected, but we need to fetch details for it
                if (response.data.bcs.data.length > 0 && !selectedBcId) {
                    const firstId = response.data.bcs.data[0].id;
                    setSelectedBcId(firstId);
                    fetchBcDetails(firstId);
                }
            }
        } catch (error) {
            console.error("Failed to fetch BCs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // DataGrid Definitions
    const colDefs: ColDef<BC>[] = useMemo(() => [
        {
            field: 'bc_number',
            headerName: 'N° BC',
            width: 160,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{params.value}</span>
                </div>
            )
        },
        {
            field: 'created_at',
            headerName: 'Date',
            width: 110,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-500">{new Date(params.value).toLocaleDateString()}</span>
                </div>
            )
        },
        {
            field: 'partner.name',
            headerName: 'Client',
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full text-gray-700 dark:text-gray-300">
                    <span className="truncate" title={params.value}>{params.value}</span>
                </div>
            )
        },
        {
            field: 'total_amount',
            headerName: 'Montant',
            width: 100,
            cellClass: 'text-right font-medium',
            valueFormatter: (params: any) => `${parseFloat(params.value).toLocaleString()} Dh`
        },
    ], []);

    // Left Sidebar: Ag-Grid List
    const SidebarContent = (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-gray-900 dark:text-white">Commandes (ADV)</h2>
                <div className="text-xs px-2 py-1 bg-sage-100 text-sage-700 rounded-full font-medium">
                    {bcs.length} à valider
                </div>
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={bcs}
                    columnDefs={colDefs}
                    loading={loading}
                    onRowSelected={(data) => {
                        setSelectedBcId(data.id);
                        fetchBcDetails(data.id);
                    }}
                />
            </div>
        </div>
    );

    return (
        <MasterLayout
            leftContent={<div className="h-full w-full overflow-hidden flex flex-col">{SidebarContent}</div>}
            mainContent={
                <div className="h-full overflow-hidden flex flex-col">
                    {detailLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-sage-500" />
                            <p>Chargement du détail...</p>
                        </div>
                    ) : selectedBcDetails ? (
                        <BcDetailView bc={selectedBcDetails} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">Sélectionnez une commande à traiter</div>
                    )}
                </div>
            }
            rightContent={<AdvActionPanel />}
        />
    );
};
