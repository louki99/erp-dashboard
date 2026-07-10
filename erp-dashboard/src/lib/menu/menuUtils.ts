import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  DEFAULT_ROUTE,
  getItemRoute,
  MENU_MODULES,
  type MenuItem,
  type MenuModule,
} from './menuData';

export interface FlatMenuItem extends MenuItem {
  moduleId: string;
  moduleName: string;
  categoryId: string;
  categoryTitle: string;
  route: string;
  icon: LucideIcon;
}

export interface UseMenuPermissionsOptions {
  userPermissions?: string[];
  userRoles?: string[];
}

/**
 * Check whether the current user satisfies a permission requirement.
 * Mirrors the original MegaMenu logic to avoid auth regressions.
 */
export function hasPermission(
  permission: string | undefined,
  userPermissions: string[] = [],
  userRoles: string[] = []
): boolean {
  if (!permission) return true;

  if (userRoles.includes('admin') || userRoles.includes('super-admin') || userRoles.includes('root')) {
    return true;
  }

  if (userPermissions.includes(permission)) {
    return true;
  }

  // Wildcard permission, e.g. user has admin.adv.*
  const parts = permission.split('.');
  for (let i = parts.length; i > 0; i--) {
    const wildcard = parts.slice(0, i).join('.') + '.*';
    if (userPermissions.includes(wildcard)) {
      return true;
    }
  }

  // Any nested permission under the required prefix,
  // e.g. module requires admin.adv and user has admin.adv.dashboard
  if (userPermissions.some((userPerm) => userPerm.startsWith(permission + '.'))) {
    return true;
  }

  return false;
}

/**
 * Return a permission-filtered copy of the menu modules.
 */
export function filterMenuByPermission(
  modules: MenuModule[],
  userPermissions?: string[],
  userRoles?: string[]
): MenuModule[] {
  const roles = userRoles ?? [];

  const canAccessModule = (module: MenuModule): boolean => {
    // Permission check passes → show
    if (hasPermission(module.requiredPermission, userPermissions, userRoles)) return true;
    // Role check as alternative: user has the required role
    if (module.requiredRole) {
      const required = Array.isArray(module.requiredRole) ? module.requiredRole : [module.requiredRole];
      if (required.some((r) => roles.includes(r))) return true;
    }
    return false;
  };

  return modules
    .filter(canAccessModule)
    .map((module) => ({
      ...module,
      categories: module.categories
        .filter((category) => hasPermission(category.permission, userPermissions, userRoles))
        .map((category) => ({
          ...category,
          items: category.items.filter((item) =>
            hasPermission(item.permission, userPermissions, userRoles)
          ),
        }))
        .filter((category) => category.items.length > 0),
    }))
    .filter((module) => module.categories.length > 0);
}

/**
 * Flatten all accessible menu items into a single list.
 * Useful for search, command palettes, and favorites resolution.
 */
export function toFlatItem(
  item: MenuItem,
  module: MenuModule,
  category: MenuModule['categories'][number]
): FlatMenuItem {
  return {
    ...item,
    route: getItemRoute(item),
    moduleId: module.id,
    moduleName: module.label,
    categoryId: category.id,
    categoryTitle: category.title,
    icon: item.icon ?? module.icon,
  };
}

export function flattenMenuItems(modules: MenuModule[]): FlatMenuItem[] {
  const items: FlatMenuItem[] = [];

  for (const module of modules) {
    for (const category of module.categories) {
      for (const item of category.items) {
        items.push(toFlatItem(item, module, category));
      }
    }
  }

  return items;
}

/**
 * React hook that returns filtered modules and a flat item list.
 */
export function useFilteredMenu(
  userPermissions: string[] = [],
  userRoles: string[] = []
) {
  return useMemo(() => {
    const modules = filterMenuByPermission(MENU_MODULES, userPermissions, userRoles);
    const items = flattenMenuItems(modules);
    return { modules, items };
  }, [userPermissions, userRoles]);
}

/**
 * Escape a user-typed string so it can be safely embedded in a RegExp.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split text around the first match of a literal query string.
 * Returns null if there is no match.
 */
export function matchTextParts(
  text: string,
  query: string
): { before: string; match: string; after: string } | null {
  const escaped = escapeRegExp(query);
  const regex = new RegExp(`(${escaped})`, 'i');
  const index = text.search(regex);
  if (index === -1) return null;

  const match = text.slice(index, index + query.length);
  return {
    before: text.slice(0, index),
    match,
    after: text.slice(index + query.length),
  };
}

export interface SearchMatch {
  item: FlatMenuItem;
  score: number;
}

/**
 * Simple fuzzy-ish search over the flat menu items.
 * Scores exact label matches higher than category/module matches.
 */
export function searchMenuItems(
  items: FlatMenuItem[],
  query: string,
  limit = 50
): SearchMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const matches: SearchMatch[] = [];

  for (const item of items) {
    const label = item.label.toLowerCase();
    const category = item.categoryTitle.toLowerCase();
    const module = item.moduleName.toLowerCase();
    const keywords = (item.keywords ?? []).join(' ').toLowerCase();

    let score = 0;

    if (label === normalizedQuery) {
      score = 100;
    } else if (label.startsWith(normalizedQuery)) {
      score = 80;
    } else if (label.includes(normalizedQuery)) {
      score = 60;
    } else if (keywords.includes(normalizedQuery)) {
      score = 50;
    } else if (category.includes(normalizedQuery)) {
      score = 40;
    } else if (module.includes(normalizedQuery)) {
      score = 30;
    }

    if (score > 0) {
      matches.push({ item, score });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Resolve a stored favorite/recent identifier (label or ID) to a concrete item.
 * This provides backward compatibility for favorites saved before IDs existed.
 */
export function resolveMenuItem(
  identifier: string,
  items: FlatMenuItem[]
): FlatMenuItem | undefined {
  // Try stable ID first.
  const byId = items.find((item) => item.id === identifier);
  if (byId) return byId;

  // Fall back to label matching for legacy storage values.
  return items.find((item) => item.label === identifier);
}

export function getItemById(
  id: string,
  items: FlatMenuItem[]
): FlatMenuItem | undefined {
  return items.find((item) => item.id === id);
}

export function getDefaultRoute(): string {
  return DEFAULT_ROUTE;
}
