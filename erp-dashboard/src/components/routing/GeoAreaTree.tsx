import { useState } from 'react';
import { ChevronRight, ChevronDown, MapPin, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeoArea } from '@/types/routing.types';

interface GeoAreaTreeProps {
    nodes: GeoArea[];
    selectedId?: number | null;
    onSelect: (area: GeoArea) => void;
}

function TreeNode({
    node,
    selectedId,
    onSelect,
    level,
}: {
    node: GeoArea;
    selectedId?: number | null;
    onSelect: (area: GeoArea) => void;
    level: number;
}) {
    const [expanded, setExpanded] = useState(level < 2);
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isSelected = selectedId === node.id;

    return (
        <div>
            <button
                onClick={() => onSelect(node)}
                className={cn(
                    'w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-lg transition-colors text-left',
                    isSelected
                        ? 'bg-sage-100 text-sage-800'
                        : 'hover:bg-gray-100 text-gray-700'
                )}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
                {hasChildren ? (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }}
                        className="p-0.5 rounded hover:bg-gray-200"
                    >
                        {expanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                        )}
                    </span>
                ) : (
                    <span className="w-5" />
                )}
                <MapPin className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-sage-600' : 'text-gray-400')} />
                <span className="truncate flex-1">{node.name}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{node.code}</span>
            </button>
            {expanded && hasChildren && (
                <div>
                    {node.children?.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function GeoAreaTree({ nodes, selectedId, onSelect }: GeoAreaTreeProps) {
    if (nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <FolderTree className="w-10 h-10 mb-2" />
                <p className="text-sm">Aucune zone géographique</p>
            </div>
        );
    }

    return (
        <div className="space-y-0.5">
            {nodes.map((node) => (
                <TreeNode
                    key={node.id}
                    node={node}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    level={0}
                />
            ))}
        </div>
    );
}
