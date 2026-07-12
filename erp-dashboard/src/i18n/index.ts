import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const SUPPORTED_LOCALES = ['fr', 'en', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'fr';
export const RTL_LOCALES: readonly SupportedLocale[] = ['ar'];

export const isRTLLocale = (locale: string): boolean => RTL_LOCALES.includes(locale as SupportedLocale);

const resources = {
    fr: { translation: fr },
    en: { translation: en },
    ar: { translation: ar },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: DEFAULT_LOCALE,
        supportedLngs: SUPPORTED_LOCALES as unknown as string[],
        debug: false,
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'erp_locale',
        },
    });

export default i18n;
