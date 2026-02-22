/**
 * PartnerFileImportDialog
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-phase import dialog for `.partner` files.
 *
 * Phase 1 — Drop zone
 *   The dialog opens with a drop target.  The user can drag a .partner file
 *   onto it or click the area to open a system file picker.
 *
 * Phase 2 — Preview
 *   After the file is parsed, a table lists every field found.  Each row
 *   shows the field label, the value from the file, the current form value
 *   (if any), and a status badge (new / modified / unchanged / unknown).
 *   The user selects which fields to apply and clicks "Appliquer".
 *
 * Export
 *   A separate "Export" button in `PartnerFormPanel` calls
 *   `serializeToPartnerFile` and triggers a browser download — no dialog
 *   needed for that direction.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
    Upload, FileText, CheckCircle2, AlertCircle, AlertTriangle,
    X, ChevronRight, Download, RefreshCw, Check, Minus, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    parsePartnerFile,
    readFileAsText,
    isPartnerFile,
    applyParsedFields,
    type ParsedField,
    type ParseResult,
    type AppliedResult,
} from '@/utils/partnerFile';

// ─── Example file ─────────────────────────────────────────────────────────────

const EXAMPLE_FILE_CONTENT = `# Partner Import File
# Version: 1.0
# Generated: 2026-02-21
# Source: ERP Dashboard — Modèle de démonstration
#
# UTILISATION
# ───────────
# Chaque ligne suit le format :  champ__:valeur;
# Les lignes commençant par # sont des commentaires (ignorées).
# Préfixe auth.*   → champs du compte utilisateur
# Préfixe cf.*     → champs personnalisés (custom fields)
# (sans préfixe)   → champs du profil partenaire

# ── Identité ──────────────────────────────────────────────────────────────────
name__:Supermarché Atlas;
partner_type__:CUSTOMER;
channel__:DIRECT;
status__:ACTIVE;

# ── Contact ───────────────────────────────────────────────────────────────────
phone__:+212600000001;
email__:atlas@example.ma;
website__:https://atlas.ma;

# ── Adresse ───────────────────────────────────────────────────────────────────
address_line1__:123 Rue Mohammed V;
city__:Casablanca;
region__:Casablanca-Settat;
country__:MA;
postal_code__:20000;

# ── Commercial ────────────────────────────────────────────────────────────────
price_list_id__:3;
payment_term_id__:2;
credit_limit__:50000;
default_discount_rate__:5;

# ── Fiscal ────────────────────────────────────────────────────────────────────
tax_number_ice__:001234567000089;
tax_exempt__:false;

# ── Livraison ─────────────────────────────────────────────────────────────────
delivery_zone__:Zone Nord Casablanca;
min_order_amount__:500;

# ── Compte utilisateur (create seulement) ────────────────────────────────────
auth.name__:Mohamed;
auth.last_name__:Atlas;
auth.email__:admin@atlas.ma;
auth.phone__:+212600000001;
auth.gender__:male;
auth.branch_code__:A0001;
auth.target_app__:B2B;

# ── Champs personnalisés ──────────────────────────────────────────────────────
cf.partner_rib__:MA0123456789012345678;
`.trimStart();

function downloadExampleFile(): void {
    const blob = new Blob([EXAMPLE_FILE_CONTENT], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'exemple-partenaire.partner';
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PartnerFileImportDialogProps {
    open: boolean;
    /** Current form values for the diff preview */
    currentPartner: Record<string, unknown>;
    currentAuth:    Record<string, unknown>;
    currentCf:      Record<string, string>;
    onApply: (result: AppliedResult) => void;
    onClose: () => void;
    /** If set, the file was pre-loaded (e.g. dragged onto the form panel) */
    preloadedFile?: File | null;
}

// ─── Status badge types ───────────────────────────────────────────────────────

type FieldStatus = 'new' | 'modified' | 'unchanged' | 'unknown';

function fieldStatus(
    field:   ParsedField,
    current: Record<string, unknown>,
    currentAuth: Record<string, unknown>,
): FieldStatus {
    if (!field.recognized) return 'unknown';

    let existing: unknown;
    if (field.section === 'auth') {
        existing = currentAuth[field.canonicalKey.replace(/^auth\./, '')];
    } else {
        existing = current[field.canonicalKey];
    }

    if (existing === undefined || existing === null || existing === '') return 'new';
    return String(existing) === field.value ? 'unchanged' : 'modified';
}

const STATUS_CONFIG: Record<FieldStatus, { label: string; cls: string; icon: React.ElementType }> = {
    new:       { label: 'Nouveau',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    modified:  { label: 'Modifié',   cls: 'bg-blue-50    text-blue-700    border-blue-200',    icon: RefreshCw    },
    unchanged: { label: 'Identique', cls: 'bg-gray-100   text-gray-500    border-gray-200',    icon: Minus        },
    unknown:   { label: 'Inconnu',   cls: 'bg-amber-50   text-amber-700   border-amber-200',   icon: AlertTriangle},
};

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = 'dropzone' | 'preview';

export const PartnerFileImportDialog: React.FC<PartnerFileImportDialogProps> = ({
    open,
    currentPartner,
    currentAuth,
    currentCf,
    onApply,
    onClose,
    preloadedFile,
}) => {
    const [phase,     setPhase]     = useState<Phase>('dropzone');
    const [dragging,  setDragging]  = useState(false);
    const [parsing,   setParsing]   = useState(false);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [selected,  setSelected]  = useState<Set<string>>(new Set());
    const [filename,  setFilename]  = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset when dialog opens / closes
    useEffect(() => {
        if (!open) {
            setPhase('dropzone');
            setParseResult(null);
            setSelected(new Set());
            setFilename('');
            setDragging(false);
        }
    }, [open]);

    // If a file was pre-loaded (drag from form), skip directly to preview
    useEffect(() => {
        if (open && preloadedFile) {
            handleFile(preloadedFile);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, preloadedFile]);

    // ── File processing ────────────────────────────────────────────────────────

    const handleFile = useCallback(async (file: File) => {
        if (!isPartnerFile(file)) {
            alert(`Le fichier "${file.name}" n'est pas un fichier .partner valide.`);
            return;
        }
        setParsing(true);
        setFilename(file.name);
        try {
            const text   = await readFileAsText(file);
            const result = parsePartnerFile(text);
            setParseResult(result);
            // Pre-select all recognized, non-unchanged fields
            const autoSelected = new Set(
                result.fields
                    .filter(f => {
                        const st = fieldStatus(f, currentPartner, currentAuth);
                        return st !== 'unchanged';
                    })
                    .map(f => f.rawKey),
            );
            setSelected(autoSelected);
            setPhase('preview');
        } finally {
            setParsing(false);
        }
    }, [currentPartner, currentAuth]);

    // ── Drag handlers ──────────────────────────────────────────────────────────

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true);  };
    const onDragLeave = ()                    => setDragging(false);
    const onDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) await handleFile(file);
    };

    // ── Selection helpers ──────────────────────────────────────────────────────

    const toggleField = (rawKey: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(rawKey) ? next.delete(rawKey) : next.add(rawKey);
            return next;
        });
    };

    const selectAll = () => {
        if (!parseResult) return;
        setSelected(new Set(parseResult.fields.map(f => f.rawKey)));
    };

    const selectNone = () => setSelected(new Set());

    const selectByStatus = (status: FieldStatus) => {
        if (!parseResult) return;
        setSelected(new Set(
            parseResult.fields
                .filter(f => fieldStatus(f, currentPartner, currentAuth) === status)
                .map(f => f.rawKey),
        ));
    };

    // ── Apply ──────────────────────────────────────────────────────────────────

    const handleApply = () => {
        if (!parseResult) return;
        const result = applyParsedFields(parseResult.fields, selected);
        onApply(result);
        onClose();
    };

    // ─────────────────────────────────────────────────────────────────────────

    if (!open) return null;

    const modal = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: '90vh', animation: 'modalIn 160ms cubic-bezier(.16,1,.3,1)' }}
            >
                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                        <FileText className="w-4.5 h-4.5 text-white w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-sm font-bold text-gray-900">
                            Importer un fichier <span className="font-mono text-indigo-600">.partner</span>
                        </h2>
                        {filename && (
                            <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{filename}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Phase 1: Drop zone ────────────────────────────────────── */}
                {phase === 'dropzone' && (
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-6 flex flex-col items-center gap-5">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".partner"
                                className="sr-only"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                            />

                            {/* Drop zone button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                className={cn(
                                    'w-full flex flex-col items-center gap-4 px-8 py-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer',
                                    dragging
                                        ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
                                        : 'border-gray-200 bg-gray-50/60 hover:border-indigo-300 hover:bg-indigo-50/40',
                                )}
                            >
                                {parsing ? (
                                    <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
                                ) : (
                                    <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
                                        dragging ? 'bg-indigo-200' : 'bg-white border-2 border-dashed border-gray-200',
                                    )}>
                                        <Upload className={cn('w-7 h-7 transition-colors', dragging ? 'text-indigo-600' : 'text-gray-400')} />
                                    </div>
                                )}
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-gray-700">
                                        {dragging ? 'Relâchez pour importer' : 'Glissez un fichier .partner ici'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        ou cliquez pour choisir depuis votre disque
                                    </p>
                                </div>
                                <div className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-500 shadow-sm">
                                    <span className="font-mono text-indigo-600">*.partner</span>
                                    &nbsp;— Format texte, champs séparés par <span className="font-mono">__:</span>
                                </div>
                            </button>

                            {/* Example file section */}
                            <div className="w-full rounded-xl border border-gray-200 overflow-hidden">
                                {/* Section header with download button */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                                        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest">
                                            Fichier d'exemple — format .partner
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={downloadExampleFile}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                        title="Télécharger le fichier d'exemple"
                                    >
                                        <Download className="w-3 h-3" />
                                        Télécharger l'exemple
                                    </button>
                                </div>

                                {/* Scrollable code block */}
                                <div className="bg-gray-900 overflow-auto" style={{ maxHeight: '320px' }}>
                                    <pre className="p-4 text-xs text-gray-300 leading-relaxed font-mono whitespace-pre">
                                        {EXAMPLE_FILE_CONTENT}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Phase 2: Preview ──────────────────────────────────────── */}
                {phase === 'preview' && parseResult && (
                    <>
                        {/* Stats bar */}
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 shrink-0 flex-wrap">
                            {([
                                ['new',      'Nouveaux'],
                                ['modified', 'Modifiés'],
                                ['unknown',  'Inconnus'],
                            ] as [FieldStatus, string][]).map(([st, label]) => {
                                const count = parseResult.fields.filter(
                                    f => fieldStatus(f, currentPartner, currentAuth) === st
                                ).length;
                                if (count === 0) return null;
                                const cfg = STATUS_CONFIG[st];
                                return (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => selectByStatus(st)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all hover:shadow-sm',
                                            cfg.cls,
                                        )}
                                        title={`Sélectionner uniquement les champs « ${label} »`}
                                    >
                                        <cfg.icon className="w-3 h-3" />
                                        {count} {label}
                                    </button>
                                );
                            })}
                            <div className="ml-auto flex items-center gap-2">
                                <button type="button" onClick={selectAll}  className="text-xs text-indigo-600 hover:underline">Tout</button>
                                <span className="text-gray-300">|</span>
                                <button type="button" onClick={selectNone} className="text-xs text-gray-400 hover:underline">Aucun</button>
                                <span className="text-[11px] text-gray-400 ml-2">
                                    {selected.size} / {parseResult.fields.length} sélectionnés
                                </span>
                            </div>
                        </div>

                        {/* Parse errors / warnings */}
                        {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
                            <div className="px-6 pt-3 space-y-1 shrink-0">
                                {parseResult.errors.map((e, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                                        <AlertCircle className="w-3 h-3 shrink-0" />{e}
                                    </div>
                                ))}
                                {parseResult.warnings.map((w, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                                        <AlertTriangle className="w-3 h-3 shrink-0" />{w}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Field list */}
                        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
                            {parseResult.fields.length === 0 ? (
                                <div className="py-12 text-center text-gray-400 text-sm">
                                    Aucun champ trouvé dans ce fichier.
                                </div>
                            ) : (
                                parseResult.fields.map(field => {
                                    const st  = fieldStatus(field, currentPartner, currentAuth);
                                    const cfg = STATUS_CONFIG[st];
                                    const isSelected = selected.has(field.rawKey);
                                    const currentVal = field.section === 'auth'
                                        ? currentAuth[field.canonicalKey.replace(/^auth\./, '')]
                                        : field.section === 'custom'
                                            ? currentCf[field.canonicalKey]
                                            : currentPartner[field.canonicalKey];

                                    return (
                                        <button
                                            key={field.rawKey}
                                            type="button"
                                            onClick={() => toggleField(field.rawKey)}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                                                isSelected
                                                    ? 'border-indigo-200 bg-indigo-50/70 shadow-sm'
                                                    : 'border-transparent bg-gray-50 hover:bg-gray-100',
                                            )}
                                        >
                                            {/* Checkbox */}
                                            <div className={cn(
                                                'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                                isSelected
                                                    ? 'bg-indigo-600 border-indigo-600'
                                                    : 'border-gray-300 bg-white',
                                            )}>
                                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                            </div>

                                            {/* Label */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-semibold text-gray-700">
                                                        {field.displayLabel}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-gray-400">
                                                        {field.rawKey}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-gray-600 font-medium truncate max-w-[200px]">
                                                        {field.value}
                                                    </span>
                                                    {st === 'modified' && currentVal !== undefined && currentVal !== '' && (
                                                        <>
                                                            <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
                                                            <span className="text-xs text-gray-400 line-through truncate max-w-[140px]">
                                                                {String(currentVal)}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status badge */}
                                            <span className={cn(
                                                'flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0',
                                                cfg.cls,
                                            )}>
                                                <cfg.icon className="w-2.5 h-2.5" />
                                                {cfg.label}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0 bg-white">
                            <button
                                type="button"
                                onClick={() => { setPhase('dropzone'); setParseResult(null); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Autre fichier
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={selected.size === 0}
                                    className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Appliquer {selected.size} champ{selected.size !== 1 ? 's' : ''}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(.97) translateY(10px); }
                    to   { opacity: 1; transform: scale(1)  translateY(0);     }
                }
            `}</style>
        </div>
    );

    return typeof document !== 'undefined'
        ? ReactDOM.createPortal(modal, document.body)
        : null;
};
