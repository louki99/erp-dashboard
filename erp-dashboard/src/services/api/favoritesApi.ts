import apiClient from './client';

export const favoritesApi = {
    /** Returns the list of menu_keys currently favorited by the authenticated user. */
    getAll: async (): Promise<string[]> => {
        const res = await apiClient.get('/api/backend/admin/favorites');
        return res.data?.data?.menu_keys ?? [];
    },

    /** Toggle: adds if absent, removes if present. Returns the new state. */
    toggle: async (menuKey: string): Promise<boolean> => {
        const res = await apiClient.post('/api/backend/admin/favorites', { menu_key: menuKey });
        return res.data?.data?.favorited ?? false;
    },

    /** Explicit remove — use for a dedicated "remove" button (no toggle risk). */
    remove: async (menuKey: string): Promise<void> => {
        await apiClient.delete('/api/backend/admin/favorites', { data: { menu_key: menuKey } });
    },
};
