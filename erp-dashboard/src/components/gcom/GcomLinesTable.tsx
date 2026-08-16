import React from 'react';
import { Package } from 'lucide-react';

// ─── Shared "document lines" grid — dense, bordered, zebra-striped, row-numbered ──
// Used for any GCOM document's line-item list (Facture, BC, and future BL/Devis).
// Deliberately a plain table, not the AG Grid DataGrid — these lists are short
// (a handful to a few dozen rows) and read-only or with a single row action,
// so a real grid's sort/filter chrome would be overkill. This just makes the
// plain table look as professional/dense as the rest of the ERP.

export interface GcomLinesColumn<T> {
    key: string;
    header: string;
    align?: 'left' | 'right' | 'center';
    width?: string; // tailwind width class, e.g. 'w-16'
    render: (row: T, index: number) => React.ReactNode;
}

export interface GcomLinesTableProps<T> {
    columns: GcomLinesColumn<T>[];
    rows: T[];
    rowKey: (row: T, index: number) => React.Key;
    emptyLabel?: string;
    emptyIcon?: React.ElementType;
    /** When set, rows get a pointer cursor + double-click handler — e.g. a
     * picker list where double-clicking a row selects it. */
    onRowDoubleClick?: (row: T, index: number) => void;
}

const alignClass = (align: GcomLinesColumn<unknown>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

export function GcomLinesTable<T>({
    columns,
    rows,
    rowKey,
    emptyLabel = 'Aucune ligne',
    emptyIcon: EmptyIcon = Package,
    onRowDoubleClick,
}: GcomLinesTableProps<T>) {
    if (rows.length === 0) {
        return (
            <div className="text-center py-10 text-xs text-gray-400 bg-gray-50/50 border border-dashed border-gray-200 rounded-xl">
                <EmptyIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                {emptyLabel}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gradient-to-b from-gray-50 to-gray-100/70 border-b border-gray-200">
                            <th className="w-9 px-2 py-2.5 text-center text-[10px] font-bold text-gray-400 border-r border-gray-200/70 whitespace-nowrap">#</th>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-r border-gray-200/70 last:border-r-0 whitespace-nowrap ${alignClass(col.align)} ${col.width ?? ''}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr
                                key={rowKey(row, idx)}
                                onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row, idx) : undefined}
                                className={`group border-b border-gray-100 last:border-b-0 transition-colors hover:bg-sage-50/70 ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'} ${onRowDoubleClick ? 'cursor-pointer' : ''}`}
                            >
                                <td className="px-2 py-2 text-center border-r border-gray-100 whitespace-nowrap">
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-semibold text-gray-400 bg-gray-100 group-hover:bg-sage-100 group-hover:text-sage-700 transition-colors">
                                        {idx + 1}
                                    </span>
                                </td>
                                {columns.map(col => (
                                    <td key={col.key} className={`px-3 py-2 border-r border-gray-100 last:border-r-0 whitespace-nowrap ${alignClass(col.align)}`}>
                                        {col.render(row, idx)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
