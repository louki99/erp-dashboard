import React, { createContext, useContext, useEffect, useState } from 'react';
import { settingsApi } from '@/services/api/settingsApi';
import { generateSagePalette } from '@/lib/theme-utils';
import { useAuth } from './AuthContext';

interface ThemeContextType {
    refreshTheme: () => Promise<void>;
    loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const { isAuthenticated } = useAuth();

    const applyTheme = (primaryColor: string, secondaryColor?: string) => {
        const palette = generateSagePalette(primaryColor);
        const root = document.documentElement;

        // Derived palette tokens (--sage-*, --primary, --ring)
        Object.entries(palette).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Direct CSS custom properties — branch-scoped since 2026-06-26 (theme-endpoint-migration).
        // These are the canonical tokens that components should reference.
        root.style.setProperty('--color-primary', primaryColor);
        if (secondaryColor) root.style.setProperty('--color-secondary', secondaryColor);
    };

    const refreshTheme = async () => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        try {
            const response = await settingsApi.getThemeSettings();
            if (response.success && response.data.primary_color) {
                applyTheme(response.data.primary_color, response.data.secondary_color);
                if (response.data.direction) {
                    document.documentElement.dir = response.data.direction;
                }
            }
        } catch (error) {
            console.error('Failed to load theme settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            refreshTheme();
        }
    }, [isAuthenticated]);

    return (
        <ThemeContext.Provider value={{ refreshTheme, loading }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
