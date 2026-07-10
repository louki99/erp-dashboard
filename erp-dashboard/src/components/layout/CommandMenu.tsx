import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Clock, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { FlatMenuItem } from '@/lib/menu/menuUtils';
import { escapeRegExp, useFilteredMenu } from '@/lib/menu/menuUtils';
import { useMenuFavorites } from '@/hooks/menu/useMenuFavorites';
import { useMenuSearch } from '@/hooks/menu/useMenuSearch';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  userId?: string;
  userPermissions?: string[];
  userRoles?: string[];
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-600/40 text-gray-900 dark:text-white font-semibold px-0.5 rounded"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export const CommandMenu: React.FC<CommandMenuProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  userId,
  userPermissions = [],
  userRoles = [],
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { items } = useFilteredMenu(userPermissions, userRoles);
  const { favorites, recent, isFavorite, toggleFavorite, addRecent } = useMenuFavorites(
    items,
    userId,
    { maxItems: 20 }
  );

  const favoriteIds = favorites.map((i) => i.id);
  const recentIds = recent.map((i) => i.id);

  const { query, setQuery, selectedIndex, setSelectedIndex, results } = useMenuSearch({
    items,
    boostIds: favoriteIds,
    recentIds,
    limit: 50,
  });

  const displayItems = query.trim() ? results : recent.length > 0 ? recent : favorites;

  const handleNavigate = useCallback(
    (item: FlatMenuItem) => {
      addRecent(item);
      onClose();
      navigate(item.route);
    },
    [addRecent, onClose, navigate]
  );

  // Sync search query with parent only when the palette is open.
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
    }
  }, [isOpen, initialQuery, setQuery]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = 'unset';
      };
    }
    document.body.style.overflow = 'unset';
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (query) {
          setQuery('');
        } else {
          onClose();
        }
        return;
      }

      if (displayItems.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % displayItems.length);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + displayItems.length) % displayItems.length);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const selected = displayItems[selectedIndex];
          if (selected) handleNavigate(selected);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, query, displayItems, selectedIndex, onClose, handleNavigate, setQuery, setSelectedIndex]);

  useEffect(() => {
    if (listRef.current && displayItems.length > 0) {
      const child = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      child?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, displayItems]);

  const handleFavoriteToggle = (e: React.MouseEvent, item: FlatMenuItem) => {
    e.stopPropagation();
    toggleFavorite(item);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0 }}
            className="fixed inset-x-0 top-24 mx-auto w-full max-w-2xl z-[70] px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="bg-white dark:bg-[#0f1419] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search commands, pages, modules..."
                  className="flex-1 bg-transparent border-none outline-none text-base py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400"
                  aria-label="Search commands"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-500">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="overflow-y-auto p-2">
                {displayItems.length === 0 ? (
                  <div className="py-12 text-center">
                    <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {query ? 'No results found' : 'Start typing or browse recent items'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {!query && recent.length > 0 && (
                      <div className="px-2 pt-1 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-3 h-3" /> Recent
                      </div>
                    )}
                    {!query && recent.length === 0 && favorites.length > 0 && (
                      <div className="px-2 pt-1 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Star className="w-3 h-3" /> Favorites
                      </div>
                    )}
                    {displayItems.map((item, index) => {
                      const active = index === selectedIndex;
                      const favorite = isFavorite(item);
                      return (
                        <div
                          key={item.id}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            'px-3 py-2.5 rounded-lg border transition-colors group flex items-center gap-3',
                            active
                              ? 'bg-sage-50 dark:bg-sage-900/20 border-sage-500'
                              : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          )}
                        >
                          <button
                            onClick={() => handleNavigate(item)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              <Highlight text={item.label} query={query} />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                              <span className="text-sage-600 dark:text-sage-400">
                                <Highlight text={item.moduleName} query={query} />
                              </span>
                              <ChevronRight className="w-3 h-3" />
                              <span className="truncate">
                                <Highlight text={item.categoryTitle} query={query} />
                              </span>
                            </div>
                          </button>
                          <button
                            onClick={(e) => handleFavoriteToggle(e, item)}
                            className={cn(
                              'p-1.5 rounded transition-colors',
                              favorite
                                ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                            )}
                            title={favorite ? 'Remove favorite' : 'Add favorite'}
                            aria-label={favorite ? 'Remove favorite' : 'Add favorite'}
                          >
                            <Star className={cn('w-4 h-4', favorite && 'fill-yellow-500')} />
                          </button>
                          <ChevronRight
                            className={cn(
                              'w-4 h-4 flex-shrink-0',
                              active ? 'text-sage-600' : 'text-gray-300 dark:text-gray-600'
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/20 px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">
                      ↑↓
                    </kbd>{' '}
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">
                      Enter
                    </kbd>{' '}
                    Select
                  </span>
                </div>
                <span>{displayItems.length} items</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
