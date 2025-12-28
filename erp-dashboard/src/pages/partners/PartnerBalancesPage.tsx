import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { SageTabs } from '@/components/common/SageTabs';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { partnerBalancesApi, type PartnerBalance, type AdjustBalanceRequest } from '@/services/api/partnerBalancesApi';
import type { ColDef } from 'ag-grid-community';
import { Wallet, Coins, ArrowRightLeft, Filter, Download, Plus, Minus, X, CheckCircle, Clock, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-quartz.css';

export const PartnerBalancesPage = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('all');
    const [selectedBalance, setSelectedBalance] = useState<PartnerBalance | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Refresh function for the ActionPanel
    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['partner-balances'] });
        toast.success('Données actualisées');
    };

    // Queries
    const { data: response, isLoading } = useQuery({
        queryKey: ['partner-balances', activeTab],
        queryFn: () => partnerBalancesApi.getBalances({
            balance_type: activeTab === 'all' ? undefined : activeTab.toUpperCase()
        })
    });

    const items = response?.data?.data || [];

    // Mutations
    const adjustMutation = useMutation({
        mutationFn: (data: AdjustBalanceRequest) => partnerBalancesApi.adjustBalance(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner-balances'] });
            toast.success('Solde mis à jour avec succès');
            setIsModalOpen(false);
            setSelectedBalance(null); // Clear selection to avoid stale data
        },
        onError: () => {
            toast.error('Erreur lors de la mise à jour du solde');
        }
    });

    const handleSaveAdjustment = (formData: FormData) => {
        if (!selectedBalance) return;

        const operation = formData.get('operation') as 'credit' | 'debit';
        const amount = Number(formData.get('amount'));
        const reason = formData.get('reason') as string;

        adjustMutation.mutate({
            partner_code: selectedBalance.partner_code,
            balance_type: selectedBalance.balance_type,
            balance: amount,
            operation: operation === 'credit' ? 'add' : 'subtract',
            reason
        });
    };

    // Tabs Configuration
    const tabs = [
        { id: 'all', label: 'Tous les Soldes', icon: Wallet, content: null },
        { id: 'points', label: 'Points Fidélité', icon: Coins, content: null },
        { id: 'budget', label: 'Budgets', icon: ArrowRightLeft, content: null },
    ];

    // Grid Columns
    const columnDefs: ColDef[] = [
        { field: 'partner_code', headerName: 'Code', width: 100, filter: true },
        {
            field: 'partner.name',
            headerName: 'Partenaire',
            flex: 1,
            filter: true,
            valueGetter: (params) => params.data.partner?.name || 'Nom Inconnu'
        },
        {
            field: 'balance_type',
            headerName: 'Type',
            width: 120,
            cellRenderer: (params: any) => {
                const colors: any = {
                    'POINTS': 'bg-purple-100 text-purple-800',
                    'BUDGET': 'bg-blue-100 text-blue-800',
                    'WALLET': 'bg-green-100 text-green-800'
                };
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[params.value] || 'bg-gray-100'}`}>
                        {params.value}
                    </span>
                );
            }
        },
        {
            field: 'balance',
            headerName: 'Solde',
            width: 130,
            type: 'numericColumn',
            cellClass: 'font-semibold text-gray-700',
            valueFormatter: (params) => {
                return new Intl.NumberFormat('fr-MA', { style: 'decimal', minimumFractionDigits: 2 }).format(params.value);
            }
        },
        {
            field: 'updated_at',
            headerName: 'MAJ',
            width: 120,
            valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString('fr-MA') : '-'
        }
    ];

    // Action Panel Configuration
    const actionGroups = [
        {
            items: [
                {
                    icon: ArrowRightLeft,
                    label: 'Ajuster Solde',
                    variant: 'sage',
                    onClick: () => setIsModalOpen(true),
                    disabled: !selectedBalance
                } as ActionItemProps,
            ]
        },
        {
            items: [
                { icon: Filter, label: 'Filtrer', variant: 'default' } as ActionItemProps,
                { icon: Download, label: 'Exporter', variant: 'default' } as ActionItemProps,
                {
                    icon: RotateCcw,
                    label: 'Actualiser',
                    variant: 'default',
                    onClick: handleRefresh
                } as ActionItemProps,
            ]
        }
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col w-[450px]">
                    <div className="p-4 border-b border-gray-100 bg-white z-10">
                        <h1 className="text-sm font-semibold text-gray-900">Soldes Partenaires</h1>
                        <p className="text-xs text-gray-500 mt-1">/api/backend/partner-balances</p>
                    </div>

                    <div className="border-b border-gray-100 bg-slate-50">
                        <SageTabs
                            tabs={tabs}
                            activeTabId={activeTab}
                            onTabChange={setActiveTab}
                            className="bg-transparent border-0"
                        />
                    </div>

                    <div className="flex-1 p-2 bg-slate-50">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full overflow-hidden flex flex-col">
                            <DataGrid
                                rowData={items}
                                columnDefs={columnDefs}
                                rowSelection="single"
                                loading={isLoading}
                                onRowSelected={(data) => setSelectedBalance(data)}
                                defaultSelectedIds={(row) => selectedBalance?.id === row.id}
                            />
                            <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-400 font-medium text-right bg-gray-50">
                                {items.length} enregistrements
                            </div>
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full overflow-y-auto bg-slate-50 p-6 flex flex-col relative w-full">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex-1 min-h-0 relative">
                        {!selectedBalance ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <Wallet className="w-16 h-16 text-gray-200 mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun solde sélectionné</h3>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto">Sélectionnez un partenaire dans la liste de gauche pour afficher les détails et effectuer des ajustements.</p>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Header */}
                                <div className="border-b border-gray-100 pb-6 mb-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900">{selectedBalance.partner?.name || 'Nom Inconnu'}</h2>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-sm font-mono font-medium border border-gray-200">{selectedBalance.partner_code}</span>
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-md text-sm font-bold uppercase tracking-wider border",
                                                    selectedBalance.balance_type === 'POINTS' ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                        selectedBalance.balance_type === 'BUDGET' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                            "bg-green-50 text-green-700 border-green-100"
                                                )}>
                                                    {selectedBalance.balance_type}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right p-4 bg-sage-50 rounded-xl border border-sage-100 mb-2">
                                            <div className="text-xs text-sage-600 uppercase tracking-widest font-bold mb-1">Solde Actuel</div>
                                            <div className="text-4xl font-black text-sage-700">
                                                {new Intl.NumberFormat('fr-MA', { style: 'decimal', minimumFractionDigits: 2 }).format(selectedBalance.balance)}
                                                <span className="text-lg text-sage-500 ml-2 font-medium">DH</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-lg shadow-sm text-blue-500">
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Dernière Mise à Jour</div>
                                            <div className="font-bold text-gray-900 text-lg">
                                                {new Date(selectedBalance.updated_at).toLocaleDateString('fr-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-lg shadow-sm text-emerald-500">
                                            <CheckCircle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Statut du Compte</div>
                                            <div className="font-bold text-emerald-600 text-lg">Actif</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Placeholder for History */}
                                <div className="mt-auto bg-blue-50 border border-blue-100 rounded-xl p-6 text-blue-800 flex items-start gap-4">
                                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
                                        <Filter className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg mb-1">Historique des transactions</h4>
                                        <p className="opacity-80 leading-relaxed">
                                            Le module d'historique détaillé des mouvements (crédits, débits, ajustements) est en cours de développement.
                                            Il sera disponible dans la prochaine version du tableau de bord.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            }
            rightContent={
                <ActionPanel groups={actionGroups} />
            }
        />
    );
};
