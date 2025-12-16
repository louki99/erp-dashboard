import { useEffect, useRef } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    height?: number;
}

export const RichTextEditor = ({ 
    value, 
    onChange, 
    placeholder = 'Entrez la description...', 
    disabled = false,
    height = 300 
}: RichTextEditorProps) => {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editorRef.current && !disabled) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value, disabled]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    if (disabled) {
        return (
            <div 
                className="prose max-w-none p-3 bg-gray-50 rounded-md border border-gray-200"
                dangerouslySetInnerHTML={{ __html: value || '<p class="text-gray-400">Aucune description</p>' }}
            />
        );
    }

    return (
        <div className="border border-gray-300 rounded-md overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-300 p-2 flex flex-wrap gap-1">
                <button
                    type="button"
                    onClick={() => execCommand('bold')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm font-bold"
                    title="Gras"
                >
                    B
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('italic')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm italic"
                    title="Italique"
                >
                    I
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('underline')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm underline"
                    title="Souligné"
                >
                    U
                </button>
                <div className="w-px bg-gray-300 mx-1"></div>
                <button
                    type="button"
                    onClick={() => execCommand('formatBlock', '<h1>')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm font-bold"
                    title="Titre 1"
                >
                    H1
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('formatBlock', '<h2>')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm font-bold"
                    title="Titre 2"
                >
                    H2
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('formatBlock', '<p>')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm"
                    title="Paragraphe"
                >
                    P
                </button>
                <div className="w-px bg-gray-300 mx-1"></div>
                <button
                    type="button"
                    onClick={() => execCommand('insertUnorderedList')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm"
                    title="Liste à puces"
                >
                    • List
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('insertOrderedList')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm"
                    title="Liste numérotée"
                >
                    1. List
                </button>
                <div className="w-px bg-gray-300 mx-1"></div>
                <button
                    type="button"
                    onClick={() => execCommand('justifyLeft')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm"
                    title="Aligner à gauche"
                >
                    ⬅
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('justifyCenter')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm"
                    title="Centrer"
                >
                    ↔
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('justifyRight')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm"
                    title="Aligner à droite"
                >
                    ➡
                </button>
                <div className="w-px bg-gray-300 mx-1"></div>
                <button
                    type="button"
                    onClick={() => execCommand('removeFormat')}
                    className="px-2 py-1 hover:bg-gray-200 rounded text-sm text-red-600"
                    title="Supprimer le formatage"
                >
                    ✕
                </button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="p-3 min-h-[200px] focus:outline-none prose max-w-none"
                style={{ height: `${height}px`, overflowY: 'auto' }}
                data-placeholder={placeholder}
            />
            <style>{`
                [contentEditable][data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
};
