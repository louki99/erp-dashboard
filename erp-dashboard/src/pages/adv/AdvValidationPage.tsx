import { useState, useEffect, useMemo, useRef } from 'react';
import apiClient from '@/services/api/client';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { Can } from '@/components/rbac';
import { useSearchParams } from 'react-router-dom';
import { BCWorkflowActions } from '@/components/adv/BCWorkflowActions';
import { WorkflowHistory } from '@/components/workflow/WorkflowHistory';
import { useAdvWorkflow } from '@/hooks/adv/useAdvWorkflow';
import {
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
    MapPin,
    History,
    Info
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
    payment_term?: {
        id: number;
        name: string;
        code?: string;
        days_number: number;
        description?: string;
    };
}

interface Product {
    id: number;
    name: string;
    code: string;
    stock?: number;
    quantity: number;
    thumbnail?: string;
    stocks?: {
        branch_code: string;
        quantity: string;
        reserved_quantity: string;
        available_quantity: string;
    }[];
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
    bc_status: string;
    is_urgent: boolean;
    is_overdue: boolean;
    items_count: number;
    partner: Partner;
    order_products: OrderProduct[];
}

interface ApiResponse {
    bcs?: {
        data: BC[];
        current_page: number;
        total: number;
    };
    bc?: BC;
    stats?: {
        pending_review: number;
    };
}

// --- Action Panel Component ---

interface User {
    id: number;
    name: string;
    email: string;
}

interface DerogationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (responsableId: number, message: string) => void;
    responsables: User[];
    isLoading: boolean;
}

const DerogationModal = ({ isOpen, onClose, onSubmit, responsables, isLoading }: DerogationModalProps) => {
    const [selectedResponsable, setSelectedResponsable] = useState<string>('');
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-amber-600">
                        <AlertTriangle className="w-6 h-6" />
                        <h3 className="text-lg font-semibold">Demande de Dérogation</h3>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                        Le plafond de crédit est dépassé. Veuillez sélectionner un responsable pour demander une dérogation.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Responsable
                            </label>
                            <select
                                value={selectedResponsable}
                                onChange={(e) => setSelectedResponsable(e.target.value)}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                            >
                                <option value="">Sélectionner un responsable</option>
                                {responsables.map(user => (
                                    <option key={user.id} value={user.id}>{user.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={3}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                                placeholder="Motif de la dérogation..."
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => onSubmit(parseInt(selectedResponsable), message)}
                            disabled={!selectedResponsable || !message || isLoading}
                            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Envoyer Demande
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    disabled?: boolean;
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }: ActionItemProps) => {
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
            disabled={disabled}
            className={cn(
                "group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto",
                disabled ? "opacity-30 cursor-not-allowed" : variants[variant]
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

interface AdvActionPanelProps {
    onApprove: () => void;
    onReject: () => void;
    onHold: () => void;
    hasSelection: boolean;
}

const AdvActionPanel = ({ onApprove, onReject, onHold, hasSelection }: AdvActionPanelProps) => {
    const { has } = usePermissions();

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40 transition-all duration-300">
            <ActionGroup>
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-sage-500 rounded-full opacity-50"></div>
                </div>
                <Can permission={PERMISSIONS.ADV.BC_APPROVE}>
                    <ActionItem
                        icon={CheckCircle}
                        label="Valider BC"
                        variant="sage"
                        onClick={onApprove}
                        disabled={!hasSelection}
                    />
                </Can>
                <Can permission={PERMISSIONS.ADV.BC_REJECT}>
                    <ActionItem
                        icon={XCircle}
                        label="Rejeter"
                        variant="danger"
                        onClick={onReject}
                        disabled={!hasSelection}
                    />
                </Can>
                <Can permission={PERMISSIONS.ADV.BC_HOLD}>
                    <ActionItem
                        icon={Clock}
                        label="Mettre en attente"
                        variant="warning"
                        onClick={onHold}
                        disabled={!hasSelection}
                    />
                </Can>
            </ActionGroup>

            <ActionGroup>
                <ActionItem icon={Printer} label="Imprimer" variant="default" disabled={!hasSelection} />
                <Can permission={PERMISSIONS.ADV.BC_EXPORT}>
                    <ActionItem icon={Download} label="Exporter PDF" variant="default" disabled={!hasSelection} />
                </Can>
                <ActionItem icon={Share2} label="Partager" variant="primary" disabled={!hasSelection} />
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
    // Calculate totals and stock status
    const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
    const totalValue = lines.reduce((sum, line) => sum + (line.quantity * parseFloat(line.price)), 0);
    const outOfStockItems = lines.filter(line => {
        const stocks = line.product.stocks || [];
        const stock = stocks[0];
        const availableQty = stock ? parseFloat(stock.available_quantity) : 0;
        return availableQty < line.quantity;
    }).length;

    const columnDefs: ColDef[] = [
        {
            headerName: 'Image',
            field: 'product.thumbnail',
            width: 70,
            cellRenderer: (params: any) => (
                <div className="flex items-center justify-center h-full py-1">
                    {params.value ? (
                        <img
                            src={params.value}
                            alt={params.data.product.name}
                            className="h-8 w-8 object-cover rounded border border-gray-200 dark:border-gray-700"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40?text=No+Img'; }}
                        />
                    ) : (
                        <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-[10px] text-gray-400">
                            No Img
                        </div>
                    )}
                </div>
            )
        },
        {
            headerName: 'Code',
            field: 'product.code',
            width: 120,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-500 text-xs">{params.value}</span>
                </div>
            )
        },
        {
            headerName: 'Article',
            field: 'product.name',
            flex: 2,
            minWidth: 200,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full min-w-0 pr-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate" title={params.value}>{params.value}</span>
                </div>
            )
        },
        {
            headerName: 'Qté',
            field: 'quantity',
            width: 90,
            cellClass: 'text-right font-medium',
            valueFormatter: (params: any) => `${params.value} ${params.data.unit}`
        },
        {
            field: 'price',
            headerName: 'Prix Unit.',
            width: 110,
            cellRenderer: (params: any) => (
                <div className="flex items-center justify-end h-full">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{parseFloat(params.value).toLocaleString()} DH</span>
                </div>
            )
        },
        {
            field: 'total_price',
            headerName: 'Total Ligne',
            width: 130,
            cellRenderer: (params: any) => {
                const qty = params.data.quantity;
                const price = parseFloat(params.data.price);
                const total = qty * price;
                return (
                    <div className="flex items-center justify-end h-full">
                        <span className="text-sm font-black text-sage-700 dark:text-sage-400">{total.toLocaleString()} DH</span>
                    </div>
                );
            }
        },
        {
            headerName: 'Disponibilité',
            width: 120,
            cellRenderer: (params: any) => {
                const stocks = params.data.product.stocks || [];
                const stock = stocks[0];
                const availableQty = stock ? parseFloat(stock.available_quantity) : 0;
                const requestedQty = params.data.quantity;
                const isAvailable = availableQty >= requestedQty;

                return (
                    <div className="flex items-center justify-center h-full">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isAvailable
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                            }`}>
                            {isAvailable ? (
                                <><CheckCircle className="w-3 h-3" /> EN STOCK</>
                            ) : (
                                <><XCircle className="w-3 h-3" /> RUPTURE</>
                            )}
                        </span>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="space-y-4">
            {/* Data Grid */}
            <div className="h-96 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg ag-theme-quartz">
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
                />
            </div>
        </div>
    );
};

const ClientInfoContent = ({ partner, bcAmount }: { partner: Partner; bcAmount: string }) => {
    const creditLimit = parseFloat(partner.credit_limit || '0');
    const creditUsed = parseFloat(partner.credit_used || '0');
    const creditAvailable = parseFloat(partner.credit_available || '0');
    const creditUtilization = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

    // Credit impact calculation
    const orderAmount = parseFloat(bcAmount || '0');
    const newBalance = creditUsed + orderAmount;
    const newUtilization = creditLimit > 0 ? (newBalance / creditLimit) * 100 : 0;
    const willExceedLimit = newBalance > creditLimit;

    return (
        <div className="grid grid-cols-1 gap-6 p-6">
            {/* Credit Impact Warning */}
            {willExceedLimit && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg mt-0.5">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-base font-bold text-red-800 dark:text-red-300 mb-1">⚠️ Dépassement du Plafond Crédit</h4>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                L'approbation de ce bon de commande dépassera la limite de crédit autorisée.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg border border-red-100 dark:border-red-900">
                            <div className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Crédit Actuel</div>
                            <div className="text-lg font-bold text-red-900 dark:text-red-300">{creditUsed.toLocaleString()} Dh</div>
                        </div>
                        <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg border border-red-100 dark:border-red-900">
                            <div className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Montant BC</div>
                            <div className="text-lg font-bold text-red-900 dark:text-red-300">+ {orderAmount.toLocaleString()} Dh</div>
                        </div>
                        <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg border border-red-100 dark:border-red-900">
                            <div className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Nouveau Solde</div>
                            <div className="text-xl font-black text-red-700 dark:text-red-300">{newBalance.toLocaleString()} Dh</div>
                        </div>
                        <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg border border-red-100 dark:border-red-900">
                            <div className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Plafond</div>
                            <div className="text-xl font-black text-red-700 dark:text-red-300">{creditLimit.toLocaleString()} Dh</div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-red-700 dark:text-red-400">Dépassement</span>
                            <span className="font-bold text-red-800 dark:text-red-300 text-lg">
                                + {(newBalance - creditLimit).toLocaleString()} Dh
                            </span>
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400 mt-2">
                            Une dérogation sera nécessaire pour valider cette commande.
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm h-full">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Informations Client</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-5">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-0.5">
                                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Code Client</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono tracking-tight">{partner.code}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-0.5">
                                    <Building className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Raison Sociale</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{partner.name}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-0.5">
                                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">ICE</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono tracking-tight">{partner.tax_number_ice || '-'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-0.5">
                                    <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ville</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{partner.city || '-'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm h-full">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Situation Financière</h3>
                        </div>

                        <div className="mb-8">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium text-gray-700 dark:text-gray-300">Utilisation Crédit</span>
                                <span className="font-bold text-gray-900 dark:text-gray-100">{creditUtilization.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden mb-2">
                                <div
                                    className={`h-full transition-all duration-500 ${creditUtilization > 100 ? 'bg-red-500' : creditUtilization > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs font-medium">
                                <span className={creditUtilization > 100 ? 'text-red-600' : 'text-emerald-600'}>
                                    {creditUsed.toLocaleString()} Dh Utilisés
                                </span>
                                <span className="text-gray-400">
                                    Plafond: {creditLimit.toLocaleString()} Dh
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Crédit Disponible</div>
                                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{creditAvailable.toLocaleString()} Dh</div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Statut</div>
                                <div className={`text-xl font-bold ${partner.credit_hold ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {partner.credit_hold ? 'Bloqué' : 'Normal'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StockAnalysisContent = ({ bc }: { bc: BC }) => {
    // Helper to get available stock
    const getStock = (p: Product) => {
        return p.stocks?.[0] ? parseFloat(p.stocks[0].available_quantity) : (p.quantity || 0);
    };

    // Calculate stock statistics
    const totalItems = bc.order_products.length;
    const availableItems = bc.order_products.filter(p => getStock(p.product) >= p.quantity).length;
    const partialItems = bc.order_products.filter(p => {
        const stock = getStock(p.product);
        return stock > 0 && stock < p.quantity;
    }).length;
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
                        {bc.order_products.filter(p => getStock(p.product) < p.quantity).map(item => (
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
                                        {getStock(item.product)} / {item.quantity}
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

const PaymentTermContent = ({ partner }: { partner: Partner }) => {
    const paymentTerm = partner.payment_term;

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payment Term Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Conditions de Paiement</h3>
                    </div>

                    {paymentTerm ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-900/30">
                                <div className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2">Terme Actuel</div>
                                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{paymentTerm.name}</div>
                                {paymentTerm.code && (
                                    <div className="text-xs text-purple-600 dark:text-purple-500 mt-1 font-mono">{paymentTerm.code}</div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Nombre de Jours</div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{paymentTerm.days_number} jours</div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                        {paymentTerm.days_number === 0 ? 'Comptant' : 'Crédit'}
                                    </div>
                                </div>
                            </div>

                            {paymentTerm.description && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">Description</div>
                                    <div className="text-sm text-blue-700 dark:text-blue-300">{paymentTerm.description}</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p>Aucune condition de paiement définie</p>
                        </div>
                    )}
                </div>

                {/* Payment Information Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Informations Paiement</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plafond de Crédit</span>
                                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    {parseFloat(partner.credit_limit).toLocaleString()} DH
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Crédit Utilisé</span>
                                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                    {parseFloat(partner.credit_used).toLocaleString()} DH
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Crédit Disponible</span>
                                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                    {parseFloat(partner.credit_available).toLocaleString()} DH
                                </span>
                            </div>
                        </div>

                        {partner.credit_hold && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">Crédit Bloqué</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const BcDetailView = ({ bc, onRefresh }: { bc: BC; onRefresh: () => void }) => {
    const { workflowHistory, isLoadingHistory } = useAdvWorkflow(bc.id);

    const tabs: TabItem[] = [
        { id: 'info', label: 'Informations', icon: Info },
        { id: 'lines', label: 'Lignes de Commande', icon: FileText },
        { id: 'client', label: 'Info Client & Crédit', icon: User },
        { id: 'stock', label: 'Analyse Stock', icon: Package },
        { id: 'payment', label: 'Conditions de Paiement', icon: CreditCard },
        { id: 'history', label: 'Historique Workflow', icon: History },
    ];

    const [activeTab, setActiveTab] = useState('info');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true,
        lines: true,
        client: true,
        stock: true,
        payment: true,
        history: true
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
            {/* Compact Header */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-b-2 border-sage-200 dark:border-sage-800 sticky top-0 z-20 shadow-sm">
                <div className="px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                            {bc.bc_number}
                        </h1>
                        <span className="text-sm text-gray-400 font-medium">#{bc.order_code}</span>
                        {bc.is_urgent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                                <AlertTriangle className="w-3 h-3" /> URGENT
                            </span>
                        )}
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-black text-sage-600 dark:text-sage-400">
                            {parseFloat(bc.total_amount).toLocaleString()}
                            <span className="text-sm font-normal text-gray-500 ml-1">DH</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-10 min-w-0">
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

                <div ref={el => { sectionRefs.current['info'] = el; }}>
                    <SageCollapsible
                        title="Informations Commande"
                        isOpen={openSections['info']}
                        onOpenChange={(open) => toggleSection('info', open)}
                    >
                        <div className="p-6 space-y-6">
                            {/* Order Details */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date de Création</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {new Date(bc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Client</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Building className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{bc.partner.name}</span>
                                            <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">{bc.partner.code}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Montant Total</label>
                                        <div className="text-2xl font-black text-sage-600 dark:text-sage-400 mt-1">
                                            {parseFloat(bc.total_amount).toLocaleString()} DH
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre d'Articles</label>
                                        <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                                            {bc.items_count} articles
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Workflow Actions */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Actions Workflow</h3>
                                <BCWorkflowActions
                                    orderId={bc.id}
                                    onSuccess={onRefresh}
                                />
                            </div>
                        </div>
                    </SageCollapsible>
                </div>

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
                        <ClientInfoContent partner={bc.partner} bcAmount={bc.total_amount} />
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

                <div ref={el => { sectionRefs.current['payment'] = el; }}>
                    <SageCollapsible
                        title="Conditions de Paiement"
                        isOpen={openSections['payment']}
                        onOpenChange={(open) => toggleSection('payment', open)}
                    >
                        <PaymentTermContent partner={bc.partner} />
                    </SageCollapsible>
                </div>

                <div ref={el => { sectionRefs.current['history'] = el; }}>
                    <SageCollapsible
                        title="Historique Workflow"
                        isOpen={openSections['history']}
                        onOpenChange={(open) => toggleSection('history', open)}
                    >
                        <div className="p-6">
                            <WorkflowHistory
                                history={workflowHistory}
                                isLoading={isLoadingHistory}
                            />
                        </div>
                    </SageCollapsible>
                </div>
            </div>
        </div>
    );
};

export const AdvValidationPage = () => {
    const { has } = usePermissions();
    const [searchParams] = useSearchParams();
    const [bcs, setBcs] = useState<BC[]>([]);
    const [selectedBcId, setSelectedBcId] = useState<number | null>(null);
    const [selectedBcDetails, setSelectedBcDetails] = useState<BC | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [detailLoading, setDetailLoading] = useState<boolean>(false);

    // Modal State
    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: 'approve' | 'reject' | 'hold' | null;
        title: string;
        description: string;
        variant: 'sage' | 'danger' | 'warning';
    }>({
        isOpen: false,
        type: null,
        title: '',
        description: '',
        variant: 'sage'
    });

    // Form State
    const [approvalMode, setApprovalMode] = useState<'standard' | 'manual' | 'forced'>('standard');
    const [autoAdjustStock, setAutoAdjustStock] = useState(true);
    const [comment, setComment] = useState('');
    const [reason, setReason] = useState('');
    const [quantities, setQuantities] = useState<Record<number, number>>({});

    // Derogation State
    const [showDerogationModal, setShowDerogationModal] = useState(false);
    const [responsables, setResponsables] = useState<User[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const fetchResponsables = async () => {
        // Mock data for now
        setResponsables([
            { id: 1, name: 'Ahmed Manager', email: 'ahmed@example.com' },
            { id: 2, name: 'Sarah Director', email: 'sarah@example.com' },
            { id: 3, name: 'Karim Responsable ADV', email: 'karim@example.com' }
        ]);
    };

    const handleAction = (action: 'approve' | 'reject' | 'hold') => {
        if (!selectedBcId) return;

        // Check permissions
        const permissionMap = {
            approve: PERMISSIONS.ADV.BC_APPROVE,
            reject: PERMISSIONS.ADV.BC_REJECT,
            hold: PERMISSIONS.ADV.BC_HOLD
        };

        if (!has(permissionMap[action])) {
            toast.error('Vous n\'avez pas la permission pour cette action');
            return;
        }

        // Reset form state
        setApprovalMode('standard');
        setAutoAdjustStock(true);
        setComment('');
        setReason('');
        setQuantities({});

        // Pre-fill quantities for manual mode if needed
        if (action === 'approve' && selectedBcDetails?.order_products) {
            const initialQtys: Record<number, number> = {};
            selectedBcDetails.order_products.forEach(line => {
                initialQtys[line.product_id] = line.quantity;
            });
            setQuantities(initialQtys);
        }

        const config = {
            approve: {
                title: 'Valider le Bon de Commande',
                description: 'Voulez-vous valider ce bon de commande ?',
                variant: 'sage' as const
            },
            reject: {
                title: 'Rejeter le Bon de Commande',
                description: 'Voulez-vous rejeter ce bon de commande ? Cette action est irréversible.',
                variant: 'danger' as const
            },
            hold: {
                title: 'Mettre en Attente',
                description: 'Voulez-vous mettre ce bon de commande en attente ?',
                variant: 'warning' as const
            }
        }[action];

        setModalConfig({
            isOpen: true,
            type: action,
            ...config
        });
    };

    const confirmAction = async () => {
        if (!selectedBcId || !modalConfig.type) return;
        setIsActionLoading(true);

        try {
            let payload: any = {};
            let endpoint = '';

            if (modalConfig.type === 'approve') {
                endpoint = `approve`;
                payload = {
                    approval_mode: approvalMode,
                    comment: comment
                };
                if (approvalMode === 'standard') {
                    payload.auto_adjust_stock = autoAdjustStock;
                } else if (approvalMode === 'manual') {
                    payload.quantities = quantities;
                }
            } else if (modalConfig.type === 'reject') {
                endpoint = `reject`;
                if (!reason) {
                    toast.error("Le motif est obligatoire pour le rejet.");
                    setIsActionLoading(false);
                    return;
                }
                payload = { reason };
            } else if (modalConfig.type === 'hold') {
                endpoint = `hold`;
                if (!reason) {
                    toast.error("Le motif est obligatoire pour la mise en attente.");
                    setIsActionLoading(false);
                    return;
                }
                payload = { reason };
            }

            await apiClient.post(`/api/backend/adv/bc/${selectedBcId}/${endpoint}`, payload);

            // Refresh data
            fetchData();
            if (selectedBcId) fetchBcDetails(String(selectedBcId));
            setModalConfig(prev => ({ ...prev, isOpen: false }));
            toast.success(`Commande ${modalConfig.type === 'approve' ? 'validée' : modalConfig.type === 'reject' ? 'rejetée' : 'mise en attente'} avec succès`);

        } catch (error: any) {
            console.error(`Failed to ${modalConfig.type} BC`, error);
            const errorMessage = error.response?.data?.message || "Erreur inconnue";

            if (modalConfig.type === 'approve' && errorMessage.includes("Credit limit exceeded")) {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                setShowDerogationModal(true);
                fetchResponsables();
                toast.error("Plafond de crédit dépassé. Veuillez demander une dérogation.");
            } else {
                toast.error(`Erreur: ${errorMessage}`);
            }
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDerogationSubmit = async (responsableId: number, message: string) => {
        if (!selectedBcId) return;
        setIsActionLoading(true);
        try {
            await apiClient.post(`/api/backend/adv/bc/${selectedBcId}/approve`, {
                approval_mode: 'derogation',
                responsable_id: responsableId,
                comment: message
            });
            setShowDerogationModal(false);
            fetchData();
            if (selectedBcId) fetchBcDetails(String(selectedBcId));
            toast.success("Demande de dérogation envoyée avec succès");
        } catch (error: any) {
            console.error("Failed to submit derogation", error);
            toast.error(error.response?.data?.message || "Erreur lors de l'envoi de la dérogation");
        } finally {
            setIsActionLoading(false);
        }
    };

    const fetchBcDetails = async (id: string) => {
        setDetailLoading(true);
        try {
            const response = await apiClient.get<ApiResponse>(`/api/backend/adv/bc/${id}`);
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
            const response = await apiClient.get<ApiResponse>('/api/backend/adv/bc');
            if (response.data?.bcs?.data) {
                setBcs(response.data.bcs.data);

                // Check if bcId is in URL query params
                const bcIdParam = searchParams.get('bcId');
                if (bcIdParam) {
                    const bcId = parseInt(bcIdParam);
                    setSelectedBcId(bcId);
                    fetchBcDetails(String(bcId));
                } else if (response.data.bcs.data.length > 0 && !selectedBcId) {
                    // Optionally select the first one if none selected
                    const firstId = response.data.bcs.data[0].id;
                    setSelectedBcId(firstId);
                    fetchBcDetails(String(firstId));
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
            pinned: 'left',
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-bold text-gray-900 dark:text-gray-100">{params.value}</span>
                </div>
            )
        },
        {
            field: 'created_at',
            headerName: 'Date',
            width: 130,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(params.value).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                        })}
                    </span>
                </div>
            )
        },
        {
            field: 'partner.name',
            headerName: 'Client',
            flex: 1,
            minWidth: 200,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full text-gray-700 dark:text-gray-300 min-w-0">
                    <span className="truncate font-medium" title={params.value}>{params.value}</span>
                </div>
            )
        },
        {
            field: 'total_amount',
            headerName: 'Montant',
            width: 130,
            cellRenderer: (params: any) => (
                <div className="flex items-center justify-end h-full">
                    <span className="font-bold text-sage-600 dark:text-sage-400">
                        {parseFloat(params.value).toLocaleString()} Dh
                    </span>
                </div>
            )
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
                    pagination={true}
                    paginationPageSize={15}
                    onRowSelected={(data) => {
                        setSelectedBcId(data.id);
                        fetchBcDetails(String(data.id));
                    }}
                    onRowDoubleClicked={(data) => {
                        document.body.style.cursor = 'wait';
                        setSelectedBcId(data.id);
                        fetchBcDetails(String(data.id));
                        setTimeout(() => {
                            document.body.style.cursor = 'default';
                        }, 500);
                    }}
                />
            </div>
        </div>
    );

    return (
        <>
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
                            <BcDetailView
                                bc={selectedBcDetails}
                                onRefresh={() => {
                                    fetchData();
                                    if (selectedBcId) fetchBcDetails(String(selectedBcId));
                                }}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">Sélectionnez une commande à traiter</div>
                        )}
                    </div>
                }
                rightContent={
                    <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40">
                        <ActionGroup>
                            <div className="w-full flex justify-center mb-1">
                                <div className="w-6 h-0.5 bg-sage-500 rounded-full opacity-50"></div>
                            </div>
                            <ActionItem icon={Printer} label="Imprimer" variant="default" disabled={!selectedBcId} />
                            <Can permission={PERMISSIONS.ADV.BC_EXPORT}>
                                <ActionItem icon={Download} label="Exporter PDF" variant="default" disabled={!selectedBcId} />
                            </Can>
                            <ActionItem icon={Share2} label="Partager" variant="primary" disabled={!selectedBcId} />
                        </ActionGroup>
                        <div className="mt-auto pb-4">
                            <ActionGroup>
                                <ActionItem icon={Settings} label="Paramètres" variant="default" />
                            </ActionGroup>
                        </div>
                    </div>
                }
            />
        </>
    );
};
