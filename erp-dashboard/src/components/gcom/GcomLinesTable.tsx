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
}

const alignClass = (align: GcomLinesColumn<unknown>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

export function GcomLinesTable<T>({
    columns,
    rows,
    rowKey,
    emptyLabel = 'Aucune ligne',
    emptyIcon: EmptyIcon = Package,
}: GcomLinesTableProps<T>) {
    if (rows.length === 0) {
        return (
            <div className="text-center py-8 text-xs text-gray-400">
                <EmptyIcon className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                {emptyLabel}
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-gray-300 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                        <th className="w-8 px-2 py-2 text-center text-[10px] font-semibold text-gray-400 border-r border-gray-200 whitespace-nowrap">#</th>
                        {columns.map(col => (
                            <th
                                key={col.key}
                                className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-r border-gray-200 last:border-r-0 whitespace-nowrap ${alignClass(col.align)} ${col.width ?? ''}`}
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
                            className={`border-b border-gray-100 last:border-b-0 transition-colors hover:bg-sage-50/60 ${idx % 2 === 1 ? 'bg-sage-50/30' : 'bg-white'}`}
                        >
                            <td className="px-2 py-1.5 text-center text-[10px] text-gray-400 font-mono border-r border-gray-100 whitespace-nowrap">{idx + 1}</td>
                            {columns.map(col => (
                                <td key={col.key} className={`px-3 py-1.5 border-r border-gray-100 last:border-r-0 whitespace-nowrap ${alignClass(col.align)}`}>
                                    {col.render(row, idx)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
