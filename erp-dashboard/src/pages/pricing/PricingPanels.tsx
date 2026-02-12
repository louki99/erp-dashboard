import React from 'react';
import { Loader2, Search, X, Tag, Calendar, AlertTriangle, DollarSign, Shield, Eye, Trash2, ToggleLeft, ToggleRight, Edit, ChevronRight } from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import type { PriceList, PriceListLine, LineDetail, PriceOverride, CreatePriceListRequest } from '@/types/pricing.types';

// ═══════════════════════════════════════════════════════════════════════════════
// LEFT PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface LeftPanelProps {
    searchInput: string;
    handleSearch: (v: string) => void;
    listError: string | null;
    listLoading: boolean;
    priceLists: PriceList[];
    columnDefs: ColDef[];
    onSelect: (row: PriceList) => void;
    paginationInfo: any;
    setListFilters: React.Dispatch<React.SetStateAction<any>>;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
    searchInput, handleSearch, listError, listLoading,
    priceLists, columnDefs, onSelect, paginationInfo, setListFilters,
}) => (
    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
        <div className="p-3 border-b border-gray-100 shrink-0">
            <h1 className="text-sm font-semibold text-gray-900 mb-2">Gestion des Tarifs</h1>
            <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                    type="text" value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Rechercher un tarif..."
                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                />
                {searchInput && (
                    <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                        <X className="w-3 h-3 text-gray-400" />
                    </button>
                )}
            </div>
        </div>

        {listError && (
            <div className="px-4 py-2 text-sm text-red-600 border-b border-gray-100 bg-red-50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {listError}
            </div>
        )}

        <div className="flex-1 min-h-0 p-2">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                {listLoading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                    </div>
                ) : (
                    <DataGrid
                        rowData={priceLists} columnDefs={columnDefs} loading={listLoading}
                        onRowSelected={undefined} onSelectionChanged={() => { }}
                        rowSelection="single" onRowDoubleClicked={onSelect}
                    />
                )}
            </div>
        </div>

        {paginationInfo && paginationInfo.last_page > 1 && (
            <div className="p-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 shrink-0">
                <span>Page {paginationInfo.current_page} / {paginationInfo.last_page}</span>
                <div className="flex gap-1">
                    <button disabled={paginationInfo.current_page <= 1}
                        onClick={() => setListFilters((prev: any) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                        className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">←</button>
                    <button disabled={paginationInfo.current_page >= paginationInfo.last_page}
                        onClick={() => setListFilters((prev: any) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                        className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">→</button>
                </div>
            </div>
        )}
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface MainPanelProps {
    showDetailPanel: boolean;
    selected: PriceList | null;
    detail: PriceList | undefined;
    detailLoading: boolean;
    tabs: TabItem[];
    activeTab: string;
    handleTabChange: (id: string) => void;
    handleExpandAll: () => void;
    handleCollapseAll: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    sectionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    openSections: Record<string, boolean>;
    toggleSection: (id: string, open: boolean) => void;
    setShowDetailPanel: (v: boolean) => void;
    selectedLine: PriceListLine | null;
    setSelectedLine: (l: PriceListLine | null) => void;
    lineData: any;
    lineLoading: boolean;
    overrides: PriceOverride[];
    overridesLoading: boolean;
    handleToggleOverride: (id: number) => void;
    handleDeleteOverride: (id: number) => void;
    setEditingOverride: (o: PriceOverride | null) => void;
    setOverrideForm: (f: any) => void;
    setShowOverrideModal: (v: boolean) => void;
    setEditingPL: (pl: PriceList | null) => void;
    setPlForm: (f: any) => void;
    setShowCreatePLModal: (v: boolean) => void;
}

export const MainPanel: React.FC<MainPanelProps> = ({
    showDetailPanel, selected, detail, detailLoading,
    tabs, activeTab, handleTabChange, handleExpandAll, handleCollapseAll,
    containerRef, sectionRefs, openSections, toggleSection, setShowDetailPanel,
    selectedLine, setSelectedLine, lineData, lineLoading,
    overrides, overridesLoading, handleToggleOverride, handleDeleteOverride,
    setEditingOverride, setOverrideForm, setShowOverrideModal,
    setEditingPL, setPlForm, setShowCreatePLModal,
}) => (
    <div className="h-full flex overflow-hidden">
        {showDetailPanel && selected ? (
            <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-gray-200 shrink-0">
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                            <button onClick={() => setShowDetailPanel(false)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0" title="Retour">
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{selected.name}</h1>
                                    <span className="px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 rounded">{selected.code}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                    <span>Rang: <strong>{selected.rank}</strong></span>
                                    <span>{selected.lines_count ?? 0} ligne(s)</span>
                                </div>
                            </div>
                        </div>
                        {detailLoading && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="shrink-0 bg-white border-b border-gray-200 overflow-hidden">
                    <SageTabs tabs={tabs} activeTabId={activeTab} onTabChange={handleTabChange}
                        onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} className="shadow-none" />
                </div>

                {/* Scrollable Sections */}
                <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scroll-smooth bg-slate-50">

                    {/* ── Informations ── */}
                    <div ref={el => { sectionRefs.current['info'] = el; }}>
                        <SageCollapsible title="Informations du tarif" isOpen={openSections['info']} onOpenChange={(o) => toggleSection('info', o)}>
                            <InfoSection detail={detail} selected={selected}
                                setEditingPL={setEditingPL} setPlForm={setPlForm} setShowCreatePLModal={setShowCreatePLModal} />
                        </SageCollapsible>
                    </div>

                    {/* ── Versions ── */}
                    <div ref={el => { sectionRefs.current['versions'] = el; }}>
                        <SageCollapsible title="Versions (Lignes)" isOpen={openSections['versions']} onOpenChange={(o) => toggleSection('versions', o)}>
                            <VersionsSection detail={detail} selectedLine={selectedLine} setSelectedLine={setSelectedLine}
                                lineData={lineData} lineLoading={lineLoading} />
                        </SageCollapsible>
                    </div>

                    {/* ── Dérogations ── */}
                    <div ref={el => { sectionRefs.current['overrides'] = el; }}>
                        <SageCollapsible title="Dérogations partenaires" isOpen={openSections['overrides']} onOpenChange={(o) => toggleSection('overrides', o)}>
                            <OverridesSection overrides={overrides} overridesLoading={overridesLoading}
                                handleToggleOverride={handleToggleOverride} handleDeleteOverride={handleDeleteOverride}
                                setEditingOverride={setEditingOverride} setOverrideForm={setOverrideForm} setShowOverrideModal={setShowOverrideModal} />
                        </SageCollapsible>
                    </div>

                    {/* ── Import ── */}
                    <div ref={el => { sectionRefs.current['import'] = el; }}>
                        <SageCollapsible title="Import / Export" isOpen={openSections['import']} onOpenChange={(o) => toggleSection('import', o)}>
                            <div className="text-center py-6 text-gray-400 text-sm">
                                <p>Utilisez le bouton <strong>Import CSV</strong> dans le panneau d'actions pour importer des détails de ligne.</p>
                                <p className="text-xs mt-1">Sélectionnez d'abord une ligne dans l'onglet Versions.</p>
                            </div>
                        </SageCollapsible>
                    </div>
                </div>
            </div>
        ) : (
            <EmptyState />
        )}
    </div>
);

// ── Info Section ──────────────────────────────────────────────────────────────

const InfoSection: React.FC<{ detail: PriceList | undefined; selected: PriceList; setEditingPL: any; setPlForm: any; setShowCreatePLModal: any }> = ({ detail, selected, setEditingPL, setPlForm, setShowCreatePLModal }) => {
    const d = detail || selected;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Code</div>
                    <div className="text-lg font-bold text-gray-900 font-mono">{d.code}</div>
                </div>
                <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Nom</div>
                    <div className="text-lg font-bold text-gray-900">{d.name}</div>
                </div>
                <div className="p-3 rounded-lg border border-blue-100 bg-blue-50 shadow-sm">
                    <div className="text-xs text-blue-600 mb-1 font-medium">Rang</div>
                    <div className="text-lg font-bold text-blue-700">{d.rank}</div>
                </div>
            </div>
            <div className="flex justify-end">
                <button onClick={() => { setEditingPL(d); setPlForm({ code: d.code, name: d.name, rank: d.rank }); setShowCreatePLModal(true); }}
                    className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 font-medium">
                    <Edit className="w-3.5 h-3.5" /> Modifier
                </button>
            </div>
            {d.created_at && (
                <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Créé le {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    {d.updated_at && <span className="ml-2">— Modifié le {new Date(d.updated_at).toLocaleDateString('fr-FR')}</span>}
                </div>
            )}
        </div>
    );
};

// ── Versions Section ──────────────────────────────────────────────────────────

const VersionsSection: React.FC<{
    detail: PriceList | undefined; selectedLine: PriceListLine | null;
    setSelectedLine: (l: PriceListLine | null) => void; lineData: any; lineLoading: boolean;
}> = ({ detail, selectedLine, setSelectedLine, lineData, lineLoading }) => {
    const lines = detail?.lines || [];

    if (lines.length === 0) {
        return (
            <div className="text-center py-6 text-gray-400">
                <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune ligne / version</p>
                <p className="text-xs mt-1">Créez une ligne via le panneau d'actions</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {lines.map((line) => (
                <div key={line.line_number} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                    <button onClick={() => setSelectedLine(selectedLine?.line_number === line.line_number ? null : line)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${line.closed ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                L{line.line_number}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-900">{line.name}</div>
                                <div className="text-xs text-gray-400">
                                    {line.start_date} → {line.end_date}
                                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${line.closed ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {line.closed ? 'Fermée' : 'Ouverte'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{line.details_count ?? line.details?.length ?? 0} produit(s)</span>
                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${selectedLine?.line_number === line.line_number ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {selectedLine?.line_number === line.line_number && (
                        <div className="border-t border-gray-100 p-3 bg-slate-50">
                            {lineLoading ? (
                                <div className="flex items-center justify-center py-4 text-gray-500 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement des détails...
                                </div>
                            ) : (
                                <LineDetailsView details={lineData?.data?.details || line.details || []} />
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── Line Detail View ──────────────────────────────────────────────────────────

const LineDetailsView: React.FC<{ details: LineDetail[] }> = ({ details }) => {
    if (details.length === 0) {
        return <div className="text-center py-4 text-gray-400 text-xs">Aucun détail de prix pour cette ligne.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                        <th className="text-left py-2 px-2 font-medium">Produit</th>
                        <th className="text-right py-2 px-2 font-medium">Prix vente</th>
                        <th className="text-right py-2 px-2 font-medium">Prix retour</th>
                        <th className="text-right py-2 px-2 font-medium">Min</th>
                        <th className="text-right py-2 px-2 font-medium">Max</th>
                        <th className="text-right py-2 px-2 font-medium">Remise %</th>
                        <th className="text-right py-2 px-2 font-medium">Remise €</th>
                    </tr>
                </thead>
                <tbody>
                    {details.map((d, i) => (
                        <tr key={d.product_id || i} className="border-b border-gray-50 hover:bg-white transition-colors">
                            <td className="py-2 px-2">
                                <div className="font-medium text-gray-900">{d.product?.name || `#${d.product_id}`}</div>
                                {d.product?.code && <div className="text-gray-400 font-mono">{d.product.code}</div>}
                            </td>
                            <td className="text-right py-2 px-2 font-semibold text-emerald-700">{d.sales_price.toFixed(2)}</td>
                            <td className="text-right py-2 px-2 text-gray-600">{d.return_price.toFixed(2)}</td>
                            <td className="text-right py-2 px-2 text-gray-500">{d.min_sales_price.toFixed(2)}</td>
                            <td className="text-right py-2 px-2 text-gray-500">{d.max_sales_price.toFixed(2)}</td>
                            <td className="text-right py-2 px-2 text-amber-600">{d.discount_rate}%</td>
                            <td className="text-right py-2 px-2 text-amber-600">{d.discount_amount.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── Overrides Section ─────────────────────────────────────────────────────────

const OverridesSection: React.FC<{
    overrides: PriceOverride[]; overridesLoading: boolean;
    handleToggleOverride: (id: number) => void; handleDeleteOverride: (id: number) => void;
    setEditingOverride: (o: PriceOverride | null) => void; setOverrideForm: (f: any) => void;
    setShowOverrideModal: (v: boolean) => void;
}> = ({ overrides, overridesLoading, handleToggleOverride, handleDeleteOverride, setEditingOverride, setOverrideForm, setShowOverrideModal }) => {
    if (overridesLoading) {
        return <div className="flex items-center justify-center py-6 text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...</div>;
    }

    if (overrides.length === 0) {
        return (
            <div className="text-center py-6 text-gray-400">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune dérogation</p>
                <p className="text-xs mt-1">Créez une dérogation via le panneau d'actions</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {overrides.map((o) => (
                <div key={o.id} className={`flex items-center gap-3 p-3 rounded-lg border ${o.active ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/50'} hover:shadow-sm transition-shadow`}>
                    <button onClick={() => handleToggleOverride(o.id)} className="shrink-0" title={o.active ? 'Désactiver' : 'Activer'}>
                        {o.active ? <ToggleRight className="w-6 h-6 text-emerald-600" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{o.partner?.name || `Partenaire #${o.partner_id}`}</span>
                            <span className="text-xs text-gray-400">→</span>
                            <span className="text-sm text-gray-700">{o.product?.name || `Produit #${o.product_id}`}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            {o.fixed_price > 0 && <span className="text-emerald-600 font-medium">Prix: {o.fixed_price.toFixed(2)}</span>}
                            {o.discount_rate > 0 && <span className="text-amber-600">-{o.discount_rate}%</span>}
                            {o.discount_amount > 0 && <span className="text-amber-600">-{o.discount_amount.toFixed(2)}€</span>}
                            <span>Priorité: {o.priority}</span>
                            <span>{o.valid_from} → {o.valid_to}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditingOverride(o); setOverrideForm({ partner_id: o.partner_id, product_id: o.product_id, fixed_price: o.fixed_price, discount_rate: o.discount_rate, discount_amount: o.discount_amount, valid_from: o.valid_from, valid_to: o.valid_to, active: o.active, priority: o.priority }); setShowOverrideModal(true); }}
                            className="p-1.5 rounded hover:bg-white transition-colors" title="Modifier">
                            <Edit className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                        <button onClick={() => handleDeleteOverride(o.id)}
                            className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── Empty State ───────────────────────────────────────────────────────────────

const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-slate-50/50">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-4 shadow-sm">
            <DollarSign className="w-10 h-10 text-blue-400" />
        </div>
        <p className="text-base font-medium text-gray-500 mb-1">Gestion des Tarifs</p>
        <p className="text-sm text-gray-400 mb-4 max-w-xs text-center">
            Double-cliquez sur un tarif dans la liste pour voir les détails, versions, dérogations et options d'import.
        </p>
        <div className="flex flex-col gap-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
                    <Tag className="w-3 h-3 text-emerald-600" />
                </div>
                <span>Listes de prix et versions</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center">
                    <Shield className="w-3 h-3 text-amber-600" />
                </div>
                <span>Dérogations partenaires</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center">
                    <Eye className="w-3 h-3 text-blue-600" />
                </div>
                <span>Prévisualisation de prix effectifs</span>
            </div>
        </div>
    </div>
);
