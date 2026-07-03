import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Settings,
  ChevronRight,
  Clock,
  X,
  Star,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { FlatMenuItem } from '@/lib/menu/menuUtils';
import { escapeRegExp, toFlatItem, useFilteredMenu } from '@/lib/menu/menuUtils';
import { useMenuFavorites } from '@/hooks/menu/useMenuFavorites';
import { useMenuSearch } from '@/hooks/menu/useMenuSearch';

interface MegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
  initialSearchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
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

export const MegaMenu: React.FC<MegaMenuProps> = ({
  isOpen,
  onClose,
  initialSearchQuery = '',
  onSearchQueryChange,
  userId,
  userPermissions = [],
  userRoles = [],
}) => {
  const navigate = useNavigate();
  const [activeModuleId, setActiveModuleId] = useState<string>('purch');
  const [showFavorites, setShowFavorites] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const { modules, items } = useFilteredMenu(userPermissions, userRoles);
  const {
    favorites,
    recent,
    isFavorite,
    toggleFavorite,
    addRecent,
    removeRecent,
    clearRecent,
  } = useMenuFavorites(items, userId);

  const favoriteIds = favorites.map((i) => i.id);
  const recentIds = recent.map((i) => i.id);

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    selectedIndex,
    setSelectedIndex,
    results: searchResults,
  } = useMenuSearch({
    items,
    boostIds: favoriteIds,
    recentIds,
    limit: 50,
  });

  // Sync search query with parent when controlled.
  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery, setSearchQuery, setSelectedIndex]);

  // Body scroll lock + focus.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = 'unset';
      };
    }
    document.body.style.overflow = 'unset';
  }, [isOpen]);

  // Reset internal UI state when the menu closes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) {
      setSelectedIndex(0);
      setShowFavorites(false);
    }
  }, [isOpen, setSelectedIndex]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Derive active module; fall back to first accessible module if current is hidden.
  const activeModule = useMemo(() => {
    const found = modules.find((m) => m.id === activeModuleId);
    return found || modules[0];
  }, [modules, activeModuleId]);

  const handleClose = useCallback(() => {
    if (!onSearchQueryChange) {
      setSearchQuery('');
    }
    setSelectedIndex(0);
    setShowFavorites(false);
    onClose();
  }, [onClose, onSearchQueryChange, setSearchQuery, setSelectedIndex]);

  const handleNavigation = useCallback(
    (item: FlatMenuItem) => {
      addRecent(item);
      handleClose();
      navigate(item.route);
    },
    [addRecent, handleClose, navigate]
  );

  // Keyboard navigation.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (searchQuery) {
          setSearchQuery('');
        } else {
          handleClose();
        }
        return;
      }

      if (searchQuery && searchResults.length > 0) {
        switch (e.key) {
          case 'ArrowDown': {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % searchResults.length);
            break;
          }
          case 'ArrowUp': {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
            break;
          }
          case 'Enter': {
            e.preventDefault();
            if (searchResults[selectedIndex]) {
              handleNavigation(searchResults[selectedIndex]);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchQuery, searchResults, selectedIndex, setSearchQuery, setSelectedIndex, handleNavigation, handleClose]);

  // Auto-scroll selected item into view.
  useEffect(() => {
    if (resultsContainerRef.current && searchResults.length > 0) {
      const selectedElement = resultsContainerRef.current.children[selectedIndex] as HTMLElement | undefined;
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, searchResults]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchQueryChange?.(value);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Menu Container */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className="fixed inset-x-0 top-14 mx-auto w-full bg-white dark:bg-[#0f1419] shadow-lg border-t border-gray-200 dark:border-gray-800 z-50 h-[85vh] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Application menu"
          >
            {/* Global Search Header */}
            <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f1419] px-6 py-4">
              <div className="max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search functions, modules, categories... (Press ESC to close)"
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 transition-colors"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    aria-label="Search menu"
                  />
                </div>
                {searchQuery && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
                    <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found</span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">↑↓</kbd>
                      Navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">Enter</kbd>
                      Select
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left Sidebar: Modules */}
              {!searchQuery && (
                <div className="w-64 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-800 flex flex-col">
                  {/* Favorites & Recent Tabs */}
                  <div className="border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center px-4 pt-3">
                      <button
                        onClick={() => setShowFavorites(false)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors',
                          !showFavorites
                            ? 'text-sage-600 dark:text-sage-400 border-sage-600'
                            : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                        )}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Recent
                      </button>
                      <button
                        onClick={() => setShowFavorites(true)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors',
                          showFavorites
                            ? 'text-sage-600 dark:text-sage-400 border-sage-600'
                            : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                        )}
                      >
                        <Star className="w-3.5 h-3.5" />
                        Favorites ({favorites.length})
                      </button>
                    </div>

                    {/* Recent Items */}
                    {!showFavorites && recent.length > 0 && (
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Last accessed</span>
                          <button
                            onClick={clearRecent}
                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear all
                          </button>
                        </div>
                        <div className="space-y-1">
                          {recent.map((item) => (
                            <div key={item.id} className="group flex items-center gap-1">
                              <button
                                onClick={() => handleNavigation(item)}
                                className="flex-1 text-left px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 rounded transition-colors truncate"
                              >
                                {item.label}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeRecent(item);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                title="Remove"
                                aria-label="Remove recent item"
                              >
                                <X className="w-3 h-3 text-gray-400 hover:text-red-600" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Favorites Items */}
                    {showFavorites && (
                      <div className="px-4 py-3">
                        {favorites.length === 0 ? (
                          <div className="text-center py-6 text-xs text-gray-500 dark:text-gray-400">
                            <Star className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                            No favorites yet
                            <p className="mt-1">Click the star icon on any item to add it</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {favorites.map((item) => (
                              <div key={item.id} className="group flex items-center gap-1">
                                <button
                                  onClick={() => handleNavigation(item)}
                                  className="flex-1 text-left px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 rounded transition-colors truncate"
                                >
                                  {item.label}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(item);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-all"
                                  title="Remove from favorites"
                                  aria-label="Remove from favorites"
                                >
                                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!showFavorites && recent.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                        No recent items
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto py-2">
                    {modules.length > 0 ? (
                      modules.map((module) => {
                        const Icon = module.icon;
                        const isActive = activeModuleId === module.id;
                        return (
                          <button
                            key={module.id}
                            onClick={() => setActiveModuleId(module.id)}
                            className={cn(
                              'w-full text-left px-5 py-3 flex items-center gap-3 transition-colors relative border-l-[3px] group',
                              isActive
                                ? 'bg-white dark:bg-gray-800 border-sage-600 text-sage-700 dark:text-sage-400 font-semibold'
                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                            )}
                            aria-expanded={isActive}
                          >
                            <Icon className={cn('w-5 h-5', isActive ? 'text-sage-600' : 'text-gray-400')} />
                            <span className="text-sm flex-1">{module.label}</span>
                            {isActive && <ChevronRight className="w-4 h-4 text-sage-500" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                        <p className="font-medium">No modules available</p>
                        <p className="text-xs mt-1">Contact your administrator for access</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right Content: Search Results or Categories & Functions */}
              <div className="flex-1 bg-white dark:bg-[#0f1419] overflow-y-auto">
                {searchQuery && searchResults.length > 0 ? (
                  /* Search Results View */
                  <div className="p-6" ref={resultsContainerRef}>
                    <div className="max-w-4xl mx-auto space-y-1.5">
                      {searchResults.map((result, index) => {
                        const isSelected = index === selectedIndex;
                        const favorite = isFavorite(result);
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleNavigation(result)}
                            className={cn(
                              'w-full text-left p-3 rounded border transition-colors group',
                              isSelected
                                ? 'bg-sage-50 dark:bg-sage-900/20 border-sage-500'
                                : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-sage-400 dark:hover:border-sage-600'
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                                  <Highlight text={result.label} query={searchQuery} />
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                  <span className="font-medium text-sage-600 dark:text-sage-400">
                                    <Highlight text={result.moduleName} query={searchQuery} />
                                  </span>
                                  <ChevronRight className="w-3 h-3" />
                                  <span><Highlight text={result.categoryTitle} query={searchQuery} /></span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(result);
                                  }}
                                  className={cn(
                                    'p-1 rounded transition-all',
                                    favorite
                                      ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                      : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                  )}
                                  title={favorite ? 'Remove from favorites' : 'Add to favorites'}
                                  aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                  <Star className={cn('w-3 h-3', favorite && 'fill-yellow-500')} />
                                </button>
                                <ChevronRight className={cn(
                                  'w-4 h-4 flex-shrink-0',
                                  isSelected ? 'text-sage-600' : 'text-gray-400'
                                )} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : searchQuery && searchResults.length === 0 ? (
                  /* No Results */
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No results found</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Try searching with different keywords</p>
                    </div>
                  </div>
                ) : (
                  /* Module Categories View */
                  <div className="p-6">
                    <AnimatePresence mode="wait">
                      {activeModule && (
                        <motion.div
                          key={activeModule.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
                            <h2 className="text-2xl font-normal text-gray-900 dark:text-white flex items-center gap-3">
                              <activeModule.icon className="w-6 h-6 text-sage-600 dark:text-sage-400" />
                              {activeModule.label}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 ml-9">{activeModule.description}</p>
                          </div>

                          <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
                            {activeModule.categories.map((category) => (
                              <div key={category.id} className="break-inside-avoid-column bg-gray-50 dark:bg-gray-800/30 rounded p-4 border border-gray-200 dark:border-gray-700">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
                                  <div className="w-1 h-3 bg-sage-500" />
                                  {category.title}
                                </h3>
                                <ul className="space-y-0.5">
                                  {category.items.map((item) => {
                                    const flatItem = toFlatItem(item, activeModule, category);
                                    const favorite = isFavorite(flatItem);
                                    return (
                                      <li key={item.id}>
                                        <div className="group/item flex items-center gap-1">
                                          <button
                                            onClick={() => handleNavigation(flatItem)}
                                            className="flex-1 text-left group flex items-center gap-2 px-2 py-2 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                          >
                                            <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-sage-600 dark:group-hover:text-sage-400" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-sage-700 dark:group-hover:text-sage-300">
                                              {item.label}
                                            </span>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFavorite(flatItem);
                                            }}
                                            className={cn(
                                              'p-1 rounded transition-all',
                                              favorite
                                                ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                                : 'opacity-0 group-hover/item:opacity-100 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                            )}
                                            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
                                            aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                                          >
                                            <Star className={cn('w-3 h-3', favorite && 'fill-yellow-500')} />
                                          </button>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with shortcuts */}
            <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/20 px-6 py-2.5">
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">ESC</kbd>
                  Close menu
                </span>
                {searchQuery && (
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">↑</kbd>
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">↓</kbd>
                    Navigate results
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">⌘K</kbd>
                  Command palette
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
