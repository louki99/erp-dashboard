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
  Command,
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
    initialQuery: initialSearchQuery,
  });

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

  const hasQuickAccess = favorites.length > 0 || recent.length > 0;

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
            className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40"
          />

          {/* Menu Container */}
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0 }}
            className="fixed inset-x-4 top-16 mx-auto max-w-7xl bg-white dark:bg-[#0f1419] shadow-2xl shadow-black/10 border border-gray-200 dark:border-gray-800 z-50 h-[85vh] rounded-xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Application menu"
          >
            {/* Global Search Header */}
            <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/50 px-6 py-4">
              <div className="max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Rechercher une fonction, un module, une catégorie… (ESC pour fermer)"
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 transition-colors"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    aria-label="Search menu"
                  />
                </div>
                {searchQuery && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
                    <span>{searchResults.length} résultat{searchResults.length !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">↑↓</kbd>
                      Naviguer
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">Entrée</kbd>
                      Ouvrir
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left Compact Module Rail */}
              {!searchQuery && (
                <div className="w-20 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto py-3">
                  {modules.length > 0 ? (
                    modules.map((module) => {
                      const Icon = module.icon;
                      const isActive = activeModuleId === module.id;
                      return (
                        <button
                          key={module.id}
                          onClick={() => setActiveModuleId(module.id)}
                          className={cn(
                            'mx-2 mb-1 flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] font-medium transition-colors border',
                            isActive
                              ? 'bg-white dark:bg-gray-800 border-sage-300 dark:border-sage-700 text-sage-700 dark:text-sage-400 shadow-sm'
                              : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200'
                          )}
                          title={module.label}
                          aria-expanded={isActive}
                        >
                          <Icon className={cn('w-5 h-5', isActive ? 'text-sage-600' : 'text-gray-500')} />
                          <span className="leading-tight text-center line-clamp-2">{module.label}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-2 py-8 text-center text-[10px] text-gray-500 dark:text-gray-400">
                      <Settings className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                      Aucun module
                    </div>
                  )}
                </div>
              )}

              {/* Right Content */}
              <div className="flex-1 bg-white dark:bg-[#0f1419] overflow-y-auto">
                {searchQuery && searchResults.length > 0 ? (
                  /* Search Results View */
                  <div className="p-6" ref={resultsContainerRef}>
                    <div className="max-w-4xl mx-auto space-y-1.5">
                      {searchResults.map((result, index) => {
                        const isSelected = index === selectedIndex;
                        const favorite = isFavorite(result);
                        const ItemIcon = result.icon;
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleNavigation(result)}
                            className={cn(
                              'w-full text-left p-3 rounded-lg border transition-colors group',
                              isSelected
                                ? 'bg-sage-50 dark:bg-sage-900/20 border-sage-500'
                                : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-sage-400 dark:hover:border-sage-600'
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                                  <ItemIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white text-sm mb-0.5">
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
                                  title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                  aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                >
                                  <Star className={cn('w-3.5 h-3.5', favorite && 'fill-yellow-500')} />
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
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun résultat</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Essayez avec d’autres mots-clés</p>
                    </div>
                  </div>
                ) : (
                  /* Module Categories View */
                  <div className="p-6">
                    <AnimatePresence mode="wait">
                      {activeModule && (
                        <motion.div
                          key={activeModule.id}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.15 }}
                        >
                          {/* Quick Access */}
                          {hasQuickAccess && (
                            <div className="mb-6 space-y-3">
                              {favorites.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Star className="w-3 h-3" /> Favoris
                                  </span>
                                  {favorites.map((item) => (
                                    <button
                                      key={`fav-${item.id}`}
                                      onClick={() => handleNavigation(item)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                                    >
                                      <item.icon className="w-3 h-3" />
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {recent.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Récents
                                  </span>
                                  {recent.map((item) => (
                                    <div key={`rec-${item.id}`} className="group relative inline-flex items-center">
                                      <button
                                        onClick={() => handleNavigation(item)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                      >
                                        <item.icon className="w-3 h-3" />
                                        {item.label}
                                      </button>
                                      <button
                                        onClick={() => removeRecent(item)}
                                        className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 p-0.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-opacity"
                                        title="Supprimer"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={clearRecent}
                                    className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 px-1"
                                  >
                                    <Trash2 className="w-3 h-3" /> Tout effacer
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Module Header */}
                          <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-sage-50 dark:bg-sage-900/20 border border-sage-100 dark:border-sage-800 flex items-center justify-center">
                                <activeModule.icon className="w-6 h-6 text-sage-600 dark:text-sage-400" />
                              </div>
                              <div>
                                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                                  {activeModule.label}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                  {activeModule.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Category Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {activeModule.categories.map((category) => (
                              <div
                                key={category.id}
                                className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-col"
                              >
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-[11px] uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <div className="w-1 h-3.5 bg-sage-500 rounded-full" />
                                  {category.title}
                                </h3>
                                <ul className="space-y-0.5 flex-1">
                                  {category.items.map((item) => {
                                    const flatItem = toFlatItem(item, activeModule, category);
                                    const favorite = isFavorite(flatItem);
                                    const ItemIcon = item.icon ?? activeModule.icon;
                                    return (
                                      <li key={item.id}>
                                        <div className="group/item flex items-center gap-1">
                                          <button
                                            onClick={() => handleNavigation(flatItem)}
                                            className="flex-1 text-left flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all"
                                          >
                                            <ItemIcon className="w-4 h-4 text-gray-400 group-hover/item:text-sage-500 transition-colors shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover/item:text-sage-700 dark:group-hover/item:text-sage-300 flex-1 truncate">
                                              {item.label}
                                            </span>
                                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover/item:text-sage-500 transition-colors shrink-0" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFavorite(flatItem);
                                            }}
                                            className={cn(
                                              'p-1.5 rounded-lg transition-all shrink-0',
                                              favorite
                                                ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                                : 'opacity-0 group-hover/item:opacity-100 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                            )}
                                            title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                            aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                          >
                                            <Star className={cn('w-3.5 h-3.5', favorite && 'fill-yellow-500')} />
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

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/20 px-6 py-2.5">
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">ESC</kbd>
                  Fermer
                </span>
                {searchQuery && (
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">↑</kbd>
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">↓</kbd>
                    Naviguer
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <Command className="w-3 h-3" />
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">⌘K</kbd>
                  Palette de commandes
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
