import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, Search, ChevronLeft, ChevronRight, Building2, Loader2, GripHorizontal } from 'lucide-react';

import { GcomLinesTable } from '@/components/gcom/GcomLinesTable';
import { getPartners } from '@/services/api/partnerApi';
import type { Partner } from '@/types/partner.types';

interface PartnerPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (partner: Partner) => void;
}

const PAGE_SIZE = 15;
const DEFAULT_SIZE = { width: 672, height: 600 };

// Same draggable/resizable shell as ConfirmationModal (per explicit request —
// "the modal on Créer le BC is good, use the same one here"), extended to
// resize both width AND height (ConfirmationModal only resizes width, height
// stays auto — fine for a text confirmation, not for a fixed-height data grid).
export const PartnerPickerModal: React.FC<PartnerPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [search, setSearch] = useState('');
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestSeq = useRef(0);

    const dragControls = useDragControls();
    const modalRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(DEFAULT_SIZE);

    const load = useCallback(async (q: string, p: number) => {
        const seq = ++requestSeq.current;
        setLoading(true);
        try {
            const res = await getPartners({ search: q.trim() || undefined, per_page: PAGE_SIZE, page: p });
            if (seq !== requestSeq.current) return;
            setPartners(res.partners.data ?? []);
            setPage(res.partners.current_page ?? p);
            setLastPage(res.partners.last_page ?? p);
            setTotal(res.partners.total ?? 0);
        } catch {
            if (seq === requestSeq.current) setPartners([]);
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, []);

    // Reset + load fresh (incl. size/position) every time the modal opens.
    useEffect(() => {
        if (!isOpen) return;
        setSearch('');
        setSize(DEFAULT_SIZE);
        load('', 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        searchDebounce.current = setTimeout(() => load(search, 1), 300);
        return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Lock body scroll while open, same as ConfirmationModal/Drawer.
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleResize = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = modalRef.current?.offsetWidth || DEFAULT_SIZE.width;
        const startHeight = modalRef.current?.offsetHeight || DEFAULT_SIZE.height;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(480, startWidth + (moveEvent.clientX - startX));
            const newHeight = Math.max(360, startHeight + (moveEvent.clientY - startY));
            setSize({ width: newWidth, height: newHeight });
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // Plain table, not AG Grid — verified live that the shared DataGrid wrapper
    // silently drops a row here (3 partners in the API response, only 2
    // rendered), same class of instability seen before on ReglementPage's
    // client list. GcomLinesTable has no virtualization/sizing tricks to get
    // wrong, so it can't reproduce that failure mode.
    const columns: import('@/components/gcom/GcomLinesTable').GcomLinesColumn<Partner>[] = [
        {
            key: 'code', header: 'Code', width: 'w-28',
            render: p => <span className="font-mono font-bold text-indigo-600">{p.code}</span>,
        },
        {
            key: 'name', header: 'Nom',
            render: p => <span className="font-semibold text-gray-900">{p.name}</span>,
        },
        {
            key: 'city', header: 'Ville', width: 'w-32',
            render: p => <span className="text-gray-500">{p.city ?? '—'}</span>,
        },
        {
            key: 'status', header: 'Statut', width: 'w-24',
            render: p => {
                const active = p.status === 'ACTIVE';
                return (
                    <span className={`inline-flex items-center gap-1 font-semibold ${active ? 'text-emerald-600' : 'text-red-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {p.status ?? '—'}
                    </span>
                );
            },
        },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[70]"
                    />
                    <div className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            ref={modalRef}
                            drag
                            dragControls={dragControls}
                            dragListener={false}
                            dragMomentum={false}
                            dragElastic={0}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
                            style={{ width: size.width, height: size.height }}
                            className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col pointer-events-auto relative"
                            role="dialog"
                            aria-modal="true"
                        >
                            {/* Drag handle */}
                            <div
                                onPointerDown={e => dragControls.start(e)}
                                className="absolute top-0 left-0 right-0 h-5 cursor-grab active:cursor-grabbing z-10 flex justify-center"
                            >
                                <div className="w-12 h-1 bg-gray-200 rounded-full mt-1.5" />
                            </div>

                            <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-sage-600" /> Sélectionner un client
                                </h2>
                                <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="shrink-0 px-5 pt-3 pb-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <input
                                        autoFocus
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Rechercher par nom, code, ville…"
                                        className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70"
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                            <X className="w-3 h-3 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto px-5">
                                {loading ? (
                                    <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                                ) : (
                                    <GcomLinesTable
                                        rows={partners}
                                        columns={columns}
                                        rowKey={p => p.id}
                                        emptyIcon={Building2}
                                        emptyLabel="Aucun client trouvé"
                                        onRowDoubleClick={p => { onSelect(p); onClose(); }}
                                    />
                                )}
                            </div>

                            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-gray-100 relative">
                                <span className="text-[11px] text-gray-400">
                                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : `${total} client${total > 1 ? 's' : ''} · double-clic pour sélectionner`}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => load(search, page - 1)}
                                        disabled={page <= 1 || loading}
                                        className="flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-[11px] text-gray-500 tabular-nums">{page} / {lastPage}</span>
                                    <button
                                        onClick={() => load(search, page + 1)}
                                        disabled={page >= lastPage || loading}
                                        className="flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Resize handle */}
                                <div
                                    onMouseDown={handleResize}
                                    className="absolute bottom-0 right-0 p-1 cursor-nwse-resize text-gray-400 hover:text-gray-600"
                                >
                                    <GripHorizontal className="w-4 h-4 transform rotate-45" />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
