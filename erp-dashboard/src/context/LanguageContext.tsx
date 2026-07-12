import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import i18n, { type SupportedLocale, isRTLLocale, DEFAULT_LOCALE } from '@/i18n';

export type { SupportedLocale } from '@/i18n';

interface LanguageContextType {
    locale: SupportedLocale;
    setLocale: (locale: SupportedLocale) => void;
    isRTL: boolean;
}

const LOCAL_STORAGE_KEY = 'erp_locale';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getInitialLocale = (): SupportedLocale => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored && ['fr', 'en', 'ar'].includes(stored)) {
        return stored as SupportedLocale;
    }
    return DEFAULT_LOCALE;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [locale, setLocaleState] = useState<SupportedLocale>(getInitialLocale);
    const isRTL = isRTLLocale(locale);

    const applyDirection = useCallback((rtl: boolean) => {
        document.documentElement.dir = rtl ? 'rtl' : 'ltr';
        document.documentElement.lang = i18n.language || DEFAULT_LOCALE;
    }, []);

    useEffect(() => {
        // Sync i18n with the persisted locale on mount.
        if (i18n.language !== locale) {
            i18n.changeLanguage(locale).catch(() => {
                // Fallback silently if i18n fails to change language.
            });
        }
        applyDirection(isRTLLocale(locale));
    }, [locale, applyDirection]);

    const setLocale = useCallback((nextLocale: SupportedLocale) => {
        if (!['fr', 'en', 'ar'].includes(nextLocale)) return;
        localStorage.setItem(LOCAL_STORAGE_KEY, nextLocale);
        i18n.changeLanguage(nextLocale).catch(() => {
            // Fallback silently.
        });
        setLocaleState(nextLocale);
        applyDirection(isRTLLocale(nextLocale));
    }, [applyDirection]);

    return (
        <LanguageContext.Provider value={{ locale, setLocale, isRTL }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
